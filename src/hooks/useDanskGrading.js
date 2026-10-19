/**
 * Dansk Grading
 *
 * AI giver kun delkarakterer pr. kriterium. Vægtning og samlet karakter
 * beregnes her i koden. Kriterier matches på id (K1, K2, ...), ikke på
 * rækkefølge, så et svar i en anden rækkefølge ikke giver forkerte karakterer.
 */

import { callAI, fjernElevnavn, navnFraFilnavn } from '../services/aiService.js';
import { SEVENTRIN, beregnVaegtetKarakter } from '../utils/karakter.js';

/**
 * Giv hvert kriterium et stabilt id ud fra dets placering i skemaet.
 * @returns {Array<{ id, delIdx, kritIdx, del, krit }>}
 */
export function kriterieListe(parsedBedoemmelse) {
  const liste = [];
  let n = 1;
  parsedBedoemmelse.dele.forEach((del, delIdx) => {
    del.kriterier.forEach((krit, kritIdx) => {
      liste.push({ id: `K${n++}`, delIdx, kritIdx, del, krit });
    });
  });
  return liste;
}

/**
 * Bed AI om at bedømme en dansk opgave ud fra bedømmelseskemaet.
 * @param {Object} parsedBedoemmelse
 * @param {string} elevbesvarelse
 * @param {string} elevNavn - filnavn
 * @param {string} submissionId
 * @param {Function} [onProgress]
 */
export async function bedoemDanskOpgave(parsedBedoemmelse, elevbesvarelse, elevNavn, submissionId, onProgress = null) {
  if (!parsedBedoemmelse?.dele?.length) {
    throw new Error('Bedømmelseskema er tomt eller ikke korrekt parsed. Kontroller at bedømmelseskemaet indeholder kriterier.');
  }

  const liste = kriterieListe(parsedBedoemmelse);

  onProgress?.('Sender til AI...');

  const payload = {
    elevbesvarelse: fjernElevnavn(elevbesvarelse, navnFraFilnavn(elevNavn)),
    dele: parsedBedoemmelse.dele.map((del, delIdx) => ({
      navn: del.navn,
      kriterier: liste
        .filter(k => k.delIdx === delIdx)
        .map(k => ({ id: k.id, navn: k.krit.navn, beskrivelse: k.krit.beskrivelse || '' }))
    }))
  };

  try {
    const { result: aiResult, usage, model, cost } = await callAI('gradeDansk', payload, {
      timeoutMs: 50000,
      onRetry: ({ attempt, maxRetries, waitSeconds }) =>
        onProgress?.(`AI optaget – nyt forsøg ${attempt}/${maxRetries} om ${waitSeconds} sek...`)
    });

    onProgress?.('Beregner karakterer...');
    const gradingResult = calculateGradingResult(parsedBedoemmelse, aiResult, elevNavn, submissionId);
    gradingResult.metadata = {
      aiProvider: 'openai',
      aiModel: model,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      cost
    };
    return gradingResult;
  } catch (error) {
    console.error('Fejl ved bedømmelse af dansk opgave:', error);
    throw new Error(`Kunne ikke bedømme opgave: ${error.message}`);
  }
}

/**
 * Sammensæt resultatet. Kaster en fejl hvis AI mangler et kriterium eller
 * giver en ugyldig karakter – hellere en tydelig fejl end en stille forkert karakter.
 */
export function calculateGradingResult(parsedBedoemmelse, aiGrading, elevNavn, submissionId) {
  const liste = kriterieListe(parsedBedoemmelse);
  const aiById = new Map((aiGrading.kriterier || []).map(k => [String(k.id).trim().toUpperCase(), k]));

  const mangler = liste.filter(k => !aiById.has(k.id));
  if (mangler.length > 0) {
    throw new Error(`AI mangler bedømmelse for: ${mangler.map(k => k.krit.navn).join(', ')}`);
  }

  const alleKriterier = [];
  const dele = parsedBedoemmelse.dele.map((del, delIdx) => {
    let delTotal = 0;
    const kriterier = del.kriterier.map((krit, kritIdx) => {
      const { id } = liste.find(k => k.delIdx === delIdx && k.kritIdx === kritIdx);
      const ai = aiById.get(id);
      const delKarakter = Number(ai.delKarakter);
      if (!SEVENTRIN.includes(delKarakter)) {
        throw new Error(`Ugyldig karakter ${ai.delKarakter} for "${krit.navn}"`);
      }
      const vaegtetScore = (delKarakter * krit.vaegt) / 100;
      delTotal += vaegtetScore;
      alleKriterier.push({ vaegt: krit.vaegt, delKarakter });
      return {
        navn: krit.navn,
        vaegt: krit.vaegt,
        delKarakter,
        vaegtetScore,
        feedback: ai.feedback || ''
      };
    });
    return { navn: del.navn, totalVaegt: del.totalVaegt, kriterier, delTotal };
  });

  const { samletKarakter, afrundetKarakter } = beregnVaegtetKarakter(alleKriterier);

  return {
    submissionId,
    elevNavn,
    fileName: elevNavn,
    dele,
    samletKarakter,
    afrundetKarakter,
    karakterBegrundelse: aiGrading.samletVurdering || ''
  };
}

/**
 * Lærerens bedømmelse ud fra AI's bedømmelse og lærerens justeringer.
 * @param {Object} aiGrading - { dele }
 * @param {Object} lærerAdjustments - { [delIdx]: { [kritIdx]: delKarakter } }
 */
export function calculateLaererGrading(aiGrading, lærerAdjustments) {
  const alleKriterier = [];
  const dele = aiGrading.dele.map((aiDel, delIdx) => {
    let delTotal = 0;
    const kriterier = aiDel.kriterier.map((aiKrit, kritIdx) => {
      const delKarakter = lærerAdjustments[delIdx]?.[kritIdx] ?? aiKrit.delKarakter;
      const vaegtetScore = (delKarakter * aiKrit.vaegt) / 100;
      delTotal += vaegtetScore;
      alleKriterier.push({ vaegt: aiKrit.vaegt, delKarakter });
      return { ...aiKrit, delKarakter, vaegtetScore };
    });
    return { ...aiDel, kriterier, delTotal };
  });

  const { samletKarakter, afrundetKarakter } = beregnVaegtetKarakter(alleKriterier);
  return { dele, samletKarakter, afrundetKarakter, timestamp: new Date() };
}

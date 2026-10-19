/**
 * Karakter-hjælpere
 *
 * Al karakterberegning sker her i koden – aldrig i AI-modellen.
 * Bruges af både Matematik (omsætningstabel) og Dansk (vægtet gennemsnit).
 */

export const SEVENTRIN = [-3, 0, 2, 4, 7, 10, 12];

/**
 * Hvad gør vi, når et gennemsnit ligger præcis midt mellem to trin (fx 5,5)?
 * false = rund ned (appens hidtidige adfærd), true = rund op.
 * Tjek reglerne for den aktuelle prøve og ret her ét sted.
 */
export const ROUND_TIES_UP = false;

/**
 * Afrund et beregnet gennemsnit til nærmeste karakter på 7-trinsskalaen.
 * @param {number} value
 * @returns {number}
 */
export function roundTo7trins(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return SEVENTRIN[0];

  let nearest = SEVENTRIN[0];
  let minDiff = Math.abs(value - nearest);

  for (const trin of SEVENTRIN) {
    const diff = Math.abs(value - trin);
    const isTie = Math.abs(diff - minDiff) < 1e-9;
    if (diff < minDiff - 1e-9 || (ROUND_TIES_UP && isTie && trin > nearest)) {
      minDiff = diff;
      nearest = trin;
    }
  }
  return nearest;
}

/** Vis karakter som på karakterbladet: 0 → "00", 2 → "02". */
export function formatKarakter(karakter) {
  if (karakter === 0) return '00';
  if (karakter === 2) return '02';
  return String(karakter);
}

// ==================== OMSÆTNINGSTABEL ====================

/**
 * En omsætningstabel er et array af rækker: { karakter, minPoint, maxPoint|null }
 * Kun minPoint er nødvendig for opslaget – maxPoint er til visning.
 */

/**
 * Normaliser tabel: sortér efter minPoint og fjern ugyldige rækker.
 * @param {Array} rows
 * @returns {Array}
 */
export function normalizeTabel(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(r => ({
      karakter: Number(r.karakter),
      minPoint: Number(r.minPoint),
      maxPoint: r.maxPoint === null || r.maxPoint === undefined || r.maxPoint === '' ? null : Number(r.maxPoint)
    }))
    .filter(r => SEVENTRIN.includes(r.karakter) && Number.isFinite(r.minPoint))
    .sort((a, b) => a.minPoint - b.minPoint);
}

/**
 * Tjek at en tabel giver mening: kendte karakterer, ingen dubletter,
 * stigende minPoint og stigende karakter.
 * @returns {{ valid: boolean, problems: string[] }}
 */
export function validateTabel(rows) {
  const problems = [];
  const sorted = normalizeTabel(rows);

  if (sorted.length < 2) {
    problems.push('Tabellen skal have mindst 2 rækker.');
  }

  const karakterer = sorted.map(r => r.karakter);
  if (new Set(karakterer).size !== karakterer.length) {
    problems.push('Samme karakter optræder flere gange.');
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].minPoint === sorted[i - 1].minPoint) {
      problems.push(`To karakterer starter ved samme pointtal (${sorted[i].minPoint}).`);
    }
    if (sorted[i].karakter <= sorted[i - 1].karakter) {
      problems.push('Karaktererne stiger ikke i takt med pointene.');
      break;
    }
  }

  return { valid: problems.length === 0, problems };
}

/**
 * Slå karakter op for et pointtal.
 * Reglen er "højeste karakter hvis minPoint ≤ point". Det virker også ved
 * halve point (fx 12,5), som falder mellem to heltalsintervaller.
 * @param {Array} rows - omsætningstabel
 * @param {number} point
 * @returns {number|null} karakter, eller null hvis tabellen er tom
 */
export function lookupKarakter(rows, point) {
  const sorted = normalizeTabel(rows);
  if (sorted.length === 0 || typeof point !== 'number' || Number.isNaN(point)) return null;

  let result = sorted[0].karakter;
  for (const row of sorted) {
    if (point >= row.minPoint) result = row.karakter;
  }
  return result;
}

/**
 * Udtræk tal fra tekst. En bindestreg mellem to tal er et interval ("13-20"),
 * ellers er den et minus ("- 3" → -3). Håndterer også unicode-minus og "00"/"02".
 * @param {string} text
 * @returns {number[]}
 */
export function extractNumbers(text) {
  const normalized = String(text)
    .replace(/[−–—]/g, '-')        // −, –, — → -
    .replace(/(\d)-(?=\d)/g, '$1 ')               // "13-20"   → interval
    .replace(/(\d)\s+-\s+(?=\d)/g, '$1 ')         // "13 - 20" → interval
    .replace(/-\s+(?=\d)/g, '-');                 // "Point - 3" → -3 ("00 -3" er allerede et minus)

  const matches = normalized.match(/-?\d+(?:[.,]\d+)?/g) || [];
  return matches.map(m => parseFloat(m.replace(',', '.')));
}

function tryTriplets(numbers) {
  // Format: karakter min max karakter min max ...
  for (let offset = 0; offset < Math.min(6, numbers.length); offset++) {
    const rows = [];
    for (let i = offset; i + 2 < numbers.length; i += 3) {
      const [karakter, minPoint, maxPoint] = [numbers[i], numbers[i + 1], numbers[i + 2]];
      if (!SEVENTRIN.includes(karakter) || maxPoint < minPoint) break;
      rows.push({ karakter, minPoint, maxPoint });
    }
    if (rows.length >= 5 && validateTabel(rows).valid) return rows;
  }
  return null;
}

function tryColumns(numbers) {
  // Format: alle karakterer først (stigende eller faldende), derefter point-intervaller
  for (let i = 0; i + 7 <= numbers.length; i++) {
    const grades = numbers.slice(i, i + 7);
    const asc = grades.every((g, idx) => g === SEVENTRIN[idx]);
    const desc = grades.every((g, idx) => g === SEVENTRIN[6 - idx]);
    if (!asc && !desc) continue;

    const rest = numbers.slice(i + 7);
    // a) min/max-par
    if (rest.length >= 14) {
      const rows = grades.map((karakter, idx) => ({
        karakter,
        minPoint: rest[idx * 2],
        maxPoint: rest[idx * 2 + 1]
      }));
      if (validateTabel(rows).valid) return rows;
    }
    // b) kun minimumspoint
    if (rest.length >= 7) {
      const rows = grades.map((karakter, idx) => ({ karakter, minPoint: rest[idx], maxPoint: null }));
      if (validateTabel(rows).valid) return rows;
    }
  }
  return null;
}

/**
 * Fortolk en omsætningstabel fra udtrukket tekst (PDF/Word).
 * Prøver flere layouts og returnerer kun en tabel, der består validering.
 * @param {string} text
 * @returns {Array|null} rækker eller null hvis tabellen ikke kunne læses sikkert
 */
export function parseOmsaetningstabel(text) {
  if (!text) return null;

  const candidates = [];
  const afterHeader = String(text).split(/Karakter.*?Point/is);
  if (afterHeader.length > 1) candidates.push(afterHeader.pop());
  candidates.push(String(text));

  for (const candidate of candidates) {
    const numbers = extractNumbers(candidate);
    const rows = tryTriplets(numbers) || tryColumns(numbers);
    if (rows) return normalizeTabel(rows);
  }
  return null;
}

// ==================== DANSK: VÆGTE ====================

/**
 * Summér kriterievægte. Kriterievægte er procent af hele prøven.
 * @param {{dele: Array}} skema
 * @returns {number}
 */
export function totalVaegt(skema) {
  if (!skema?.dele) return 0;
  return skema.dele.reduce(
    (sum, del) => sum + del.kriterier.reduce((s, k) => s + (Number(k.vaegt) || 0), 0),
    0
  );
}

/** Er vægtene tæt nok på 100 %? */
export function vaegteSummererTil100(skema, tolerance = 0.1) {
  return Math.abs(totalVaegt(skema) - 100) <= tolerance;
}

/**
 * Beregn vægtet gennemsnit og afrundet karakter.
 * @param {Array} kriterier - [{ vaegt, delKarakter }]
 * @returns {{ samletKarakter: number, afrundetKarakter: number }}
 */
export function beregnVaegtetKarakter(kriterier) {
  const sumVaegt = kriterier.reduce((s, k) => s + (Number(k.vaegt) || 0), 0);
  const sum = kriterier.reduce((s, k) => s + k.delKarakter * (Number(k.vaegt) || 0), 0);
  // Normaliser med den faktiske vægtsum, så karakteren ikke skævvrides,
  // hvis vægtene ikke summerer præcis til 100.
  const samletKarakter = sumVaegt > 0 ? sum / sumVaegt : 0;
  return { samletKarakter, afrundetKarakter: roundTo7trins(samletKarakter) };
}

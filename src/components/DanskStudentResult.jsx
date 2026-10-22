/**
 * Dansk: én elevs bedømmelse pr. kriterium. Læreren kan ændre delkarakterer og godkende.
 * Kriterier og vægte følger bedømmelseskemaet dynamisk.
 */
import { BesvarelseForbrug } from './UsageInfo.jsx';
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { getSubmissions, updateTeacherGrading, recalculateExamStats } from '../services/firestoreService.js';
import { getFileDownloadURL } from '../services/storageService.js';
import { beregnVaegtetKarakter, SEVENTRIN, formatKarakter } from '../utils/karakter.js';
import { GradeMark } from './ui.jsx';
import { ExternalLink, Loader2 } from './Icons.jsx';

const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');

export function DanskStudentResult({ result, index, parsedBedoemmelse, examId, submissions = null, onSave, onPrint = null }) {
  const [submissionPath, setSubmissionPath] = useState(null);
  const [temp, setTemp] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!examId || !result.submissionId) return;
      try {
        const list = submissions ?? await getSubmissions(examId);
        const submission = list.find(sub => sub.id === result.submissionId);
        if (submission?.storagePath) setSubmissionPath(submission.storagePath);
      } catch (err) {
        console.debug('Kunne ikke finde besvarelsens fil:', err.message);
      }
    };
    load();
  }, [examId, result.submissionId, submissions]);

  const approved = Boolean(result.lærerGrading);
  const base = result.lærerGrading || { dele: result.dele, samletKarakter: result.samletKarakter, afrundetKarakter: result.afrundetKarakter };
  const skema = parsedBedoemmelse?.dele?.length ? parsedBedoemmelse : { dele: result.dele };

  // Live beregning ud fra lærerens valg
  const alle = [];
  const dele = (skema.dele || []).map((del, d) => {
    let delTotal = 0;
    const kriterier = del.kriterier.map((krit, k) => {
      const baseKrit = base.dele?.[d]?.kriterier?.[k] || {};
      const aiKrit = result.dele?.[d]?.kriterier?.[k] || {};
      const delKarakter = temp[`${d}-${k}`] ?? baseKrit.delKarakter ?? aiKrit.delKarakter ?? 0;
      const vaegtetScore = (delKarakter * krit.vaegt) / 100;
      delTotal += vaegtetScore;
      alle.push({ vaegt: krit.vaegt, delKarakter });
      return { navn: krit.navn, vaegt: krit.vaegt, delKarakter, vaegtetScore, aiKarakter: aiKrit.delKarakter, feedback: aiKrit.feedback || '', usikker: Boolean(aiKrit.usikker), usikkerhed: aiKrit.usikkerhed || '' };
    });
    return { navn: del.navn, totalVaegt: del.totalVaegt, kriterier, delTotal };
  });
  const { samletKarakter, afrundetKarakter } = beregnVaegtetKarakter(alle);
  const changed = Object.keys(temp).length > 0;

  const handleSave = async () => {
    try {
      setSaving(true);
      const lærerGrading = {
        dele: dele.map(d => ({ ...d, kriterier: d.kriterier.map(({ aiKarakter, usikker, usikkerhed, ...rest }) => rest) })),
        samletKarakter,
        afrundetKarakter,
        timestamp: new Date()
      };
      if (examId && result.id) {
        await updateTeacherGrading(examId, result.id, lærerGrading);
        await recalculateExamStats(examId);
      }
      setTemp({});
      toast.success(`Godkendt: ${formatKarakter(afrundetKarakter)}`);
      onSave?.(index, lærerGrading);
    } catch (error) {
      toast.error(`Karakteren kunne ikke gemmes: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const openSubmission = async () => {
    try {
      window.open(await getFileDownloadURL(submissionPath), '_blank', 'noopener');
    } catch (err) {
      toast.error('Besvarelsen kunne ikke åbnes: ' + err.message);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] items-start">
      <div className="surface overflow-hidden min-w-0">
        <table className="table">
          <thead>
            <tr>
              <th>Kriterium</th>
              <th className="hidden sm:table-cell w-20 text-right">Vægt</th>
              <th className="w-16 text-right">AI</th>
              <th className="w-20 sm:w-28 text-right"><span className="sm:hidden">Din</span><span className="hidden sm:inline">Din karakter</span></th>
            </tr>
          </thead>
          {dele.map((del, d) => (
            <tbody key={d}>
              <tr>
                <td colSpan={4} className="bg-paper/60 !py-2 text-[13px] font-semibold text-ink-soft">{del.navn}</td>
              </tr>
              {del.kriterier.map((krit, k) => {
                const afviger = krit.delKarakter !== krit.aiKarakter;
                return (
                  <tr key={k}>
                    <td>
                      <span className="block font-medium">{krit.navn}</span>
                      {krit.feedback && <span className="block text-[13px] text-ink-soft">{krit.feedback}</span>}
                      {krit.usikker && (
                        <span className="mt-1 block text-[13px] text-pen">AI er usikker{krit.usikkerhed ? `: ${krit.usikkerhed}` : ''}</span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell num text-right text-ink-soft whitespace-nowrap">{String(krit.vaegt).replace('.', ',')} %</td>
                    <td className="num text-right">{formatKarakter(krit.aiKarakter)}</td>
                    <td className="text-right">
                      <select
                        value={krit.delKarakter}
                        onChange={(e) => setTemp(prev => ({ ...prev, [`${d}-${k}`]: parseInt(e.target.value, 10) }))}
                        className={`input num h-8 w-20 ml-auto px-2 ${afviger ? 'border-ink font-semibold' : ''}`}
                        aria-label={`Din karakter for ${krit.navn}`}
                      >
                        {SEVENTRIN.map(t => <option key={t} value={t}>{formatKarakter(t)}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <div className="surface p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[13px] text-ink-soft">Vægtet gennemsnit</p>
              <p className="num text-[22px] font-semibold leading-tight">{fmt(samletKarakter)}</p>
            </div>
            <div className="text-right">
              <p className="text-[13px] text-ink-soft mb-1">Karakter</p>
              <GradeMark karakter={afrundetKarakter} approved={approved && !changed} size="lg" />
            </div>
          </div>
          {(approved || changed) && (
            <p className="mt-3 text-[13px] text-ink-soft">AI foreslog {fmt(result.samletKarakter ?? 0)}, altså {formatKarakter(result.afrundetKarakter)}.</p>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className="btn-primary w-full" onClick={handleSave} disabled={saving || (approved && !changed)}>
              {saving && <Loader2 />}
              {approved && !changed ? 'Godkendt' : approved ? 'Gem ændringer' : changed ? 'Godkend med dine karakterer' : 'Godkend karakter'}
            </button>
            {changed && <button type="button" className="btn-ghost w-full" onClick={() => setTemp({})}>Fortryd ændringer</button>}
          </div>
          {approved && !changed && <p className="mt-2 text-[13px] text-ok">Vælg en anden delkarakter for at ændre.</p>}
        </div>

        {result.karakterBegrundelse && (
          <div className="text-sm px-1">
            <p className="font-semibold">AI's vurdering</p>
            <p className="text-ink-soft">{result.karakterBegrundelse}</p>
          </div>
        )}

        {onPrint && (
            <button type="button" className="btn-secondary w-full" onClick={onPrint}>Print feedback til eleven</button>
        )}

        <BesvarelseForbrug result={result} />

        {submissionPath && (
          <button type="button" onClick={openSubmission} className="btn-secondary w-full">
            Se besvarelsen <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </aside>
    </div>
  );
}

/**
 * Igangværende retninger – holdes uden for React, så en retning fortsætter,
 * selvom læreren går til en anden side i appen, og siden viser fremdriften igen ved tilbagekomst.
 *
 * Hvert resultat gemmes i Firestore, så snart det er klar.
 * Genindlæses eller lukkes fanen, huskes retningen i browseren (localStorage). Når prøven åbnes igen,
 * fortsætter retningen automatisk, og de AI-job, der var i gang på serveren, hentes igen (se callAI resumeKey).
 */
import { useSyncExternalStore } from 'react';

const runs = new Map();
const listeners = new Set();
let activeSnapshot = [];

// ---------- Afbrudte retninger (fra en tidligere sideindlæsning) ----------
const MARK_PREFIX = 'aiRetning:';
const MARK_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function writeMark(examId, data) {
  try { localStorage.setItem(MARK_PREFIX + examId, JSON.stringify(data)); } catch { /* ignorér */ }
}
function removeMark(examId) {
  try { localStorage.removeItem(MARK_PREFIX + examId); } catch { /* ignorér */ }
}
function readMarks() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(MARK_PREFIX)) continue;
      try {
        const v = JSON.parse(localStorage.getItem(key));
        if (v?.examId && Date.now() - (v.startedAt || 0) < MARK_MAX_AGE_MS) out.push(v);
      } catch { /* ugyldig */ }
    }
  } catch { /* ingen browser-lager */ }
  return out;
}

// Retninger, der stadig var i gang, da siden sidst blev lukket/genindlæst
let interrupted = readMarks();

export const getInterruptedRuns = () => interrupted;
export const getInterrupted = (examId) => interrupted.find(r => r.examId === examId) || null;

/** Læreren vil ikke fortsætte den afbrudte retning. */
export function dismissInterrupted(examId) {
  removeMark(examId);
  if (!interrupted.some(r => r.examId === examId)) return;
  interrupted = interrupted.filter(r => r.examId !== examId);
  emit();
}

function emit() {
  activeSnapshot = [...runs.values()].filter(r => r.running);
  listeners.forEach(fn => fn());
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getRun = (examId) => (examId ? runs.get(examId) || null : null);
export const getActiveRuns = () => activeSnapshot;
export const isRunning = (examId) => Boolean(getRun(examId)?.running);

/** Start en retning. Returnerer false, hvis prøven allerede rettes. */
export function startRun(examId, { title = '', type = 'Matematik', total = 0 } = {}) {
  if (isRunning(examId)) return false;
  runs.set(examId, {
    examId, title, type, total,
    running: true,
    done: 0,
    current: '',
    message: '',
    phase: '',
    retryInfo: null,
    results: [],
    startedAt: Date.now(),
    finishedAt: null,
    summary: null
  });
  writeMark(examId, { examId, title, type, startedAt: Date.now() });
  interrupted = interrupted.filter(r => r.examId !== examId);
  emit();
  return true;
}

export function updateRun(examId, patch) {
  const run = runs.get(examId);
  if (!run || !run.running) return;
  const next = typeof patch === 'function' ? patch(run) : patch;
  runs.set(examId, { ...run, ...next });
  emit();
}

/** Et færdigt (eller fejlet) resultat for én elev. */
export function addRunResult(examId, result) {
  const run = runs.get(examId);
  if (!run) return;
  const id = resultId(result);
  const results = [...run.results.filter(r => resultId(r) !== id), result];
  runs.set(examId, { ...run, results, done: run.done + 1, retryInfo: null, current: '' });
  emit();
}

export function finishRun(examId, summary = null) {
  const run = runs.get(examId);
  if (!run) return;
  runs.set(examId, { ...run, running: false, finishedAt: Date.now(), summary, current: '', phase: '', retryInfo: null });
  removeMark(examId);
  emit();
}

/** Glem en retning (fx når alle rettelser slettes, så gamle resultater ikke flettes ind igen). */
export function clearRun(examId) {
  if (isRunning(examId)) return;
  if (runs.delete(examId)) emit();
}

export function resultId(r) {
  return r?.submissionId || r?.fileName?.replace(/\.[^/.]+$/, '') || r?.elevNavn || '';
}

/** Flet resultater ind i en liste (samme elev erstattes). */
export function mergeResults(base, extra) {
  if (!extra?.length) return base;
  const out = [...base];
  for (const r of extra) {
    const i = out.findIndex(x => resultId(x) === resultId(r));
    if (i === -1) out.push(r);
    else if (r.error && !out[i].error) continue; // et gemt resultat vinder over en senere fejl
    else out[i] = { ...out[i], ...r };
  }
  return out;
}

export function useGradingRun(examId) {
  return useSyncExternalStore(subscribe, () => getRun(examId), () => null);
}

export function useActiveRuns() {
  return useSyncExternalStore(subscribe, getActiveRuns, () => []);
}

export function useInterruptedRuns() {
  return useSyncExternalStore(subscribe, getInterruptedRuns, () => []);
}

// Advar før genindlæsning/lukning, mens en retning kører (den fortsætter, men først når prøven åbnes igen)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (activeSnapshot.length === 0) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

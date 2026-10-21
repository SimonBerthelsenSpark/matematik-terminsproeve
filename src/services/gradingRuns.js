/**
 * Igangværende retninger – holdes uden for React, så en retning fortsætter,
 * selvom læreren går til en anden side i appen, og siden viser fremdriften igen ved tilbagekomst.
 *
 * En genindlæsning af browseren stopper retningen; derfor advares der ved forsøg på at lukke/genindlæse.
 * Hvert resultat gemmes i Firestore, så snart det er klar, så højst den igangværende elev går tabt.
 */
import { useSyncExternalStore } from 'react';

const runs = new Map();
const listeners = new Set();
let activeSnapshot = [];

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
  runs.set(examId, { ...run, results, done: run.done + 1, retryInfo: null });
  emit();
}

export function finishRun(examId, summary = null) {
  const run = runs.get(examId);
  if (!run) return;
  runs.set(examId, { ...run, running: false, finishedAt: Date.now(), summary, current: '', phase: '', retryInfo: null });
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

// Advar før genindlæsning/lukning, mens en retning kører
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (activeSnapshot.length === 0) return;
    e.preventDefault();
    e.returnValue = '';
  });
}

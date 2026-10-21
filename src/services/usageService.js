/**
 * Registrering af AI-forbrug (tokens og anslået pris).
 * - usageDaily/{uid}_{YYYY-MM-DD}: lærerens forbrug pr. dag, også fordelt på opgavetype
 * - exams/{id}.usage: forbrug pr. prøve (retning, spørgsmål og forklaringer)
 * Tallene lægges til med increment(), så samtidige kald ikke overskriver hinanden.
 */
import { collection, doc, getDocs, setDoc, updateDoc, increment, serverTimestamp, query, where } from 'firebase/firestore';
import { db, kraevUid } from '../config/firebase.js';
import { normalizeUsage, dagNoegle, addUsage } from '../utils/usage.js';

const inc = (u, cost) => ({
  calls: increment(1),
  inputTokens: increment(u.inputTokens),
  outputTokens: increment(u.outputTokens),
  reasoningTokens: increment(u.reasoningTokens),
  cachedTokens: increment(u.cachedTokens),
  cost: increment(Number(cost) || 0)
});

export async function recordUsage({ task, examId, usage, cost }) {
  if (!usage) return;
  const u = normalizeUsage(usage);
  const dag = dagNoegle();
  const uid = kraevUid();
  const writes = [
    setDoc(doc(db, 'usageDaily', `${uid}_${dag}`), {
      ownerUid: uid,
      dato: dag,
      ...inc(u, cost),
      opgaver: { [task]: inc(u, cost) },
      updatedAt: serverTimestamp()
    }, { merge: true })
  ];
  if (examId) {
    // updateDoc (ikke setDoc) så en slettet prøve ikke genopstår
    const felter = inc(u, cost);
    writes.push(updateDoc(doc(db, 'exams', examId),
      Object.fromEntries(Object.entries(felter).map(([k, v]) => [`usage.${k}`, v]))));
  }
  const res = await Promise.allSettled(writes);
  res.filter(r => r.status === 'rejected').forEach(r => console.warn('Forbrug kunne ikke gemmes:', r.reason?.message));
}

/**
 * Forbrug pr. dag, nyeste først. Dokumenter for samme dag lægges sammen.
 * @param {Object} [options]
 * @param {boolean} [options.alle] - alle læreres forbrug (kun administratorer)
 */
export async function getDailyUsage({ alle = false } = {}) {
  const q = alle ? collection(db, 'usageDaily') : query(collection(db, 'usageDaily'), where('ownerUid', '==', kraevUid()));
  const snap = await getDocs(q);
  return samlPrDag(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}

/** Læg dokumenter for samme dato sammen (flere lærere, eller gamle dokumenter uden lærer-id). */
export function samlPrDag(docs) {
  const dage = new Map();
  for (const d of docs) {
    const dato = d.dato || d.id.slice(-10);
    const cur = dage.get(dato);
    const opgaver = { ...(cur?.opgaver || {}) };
    for (const [task, u] of Object.entries(d.opgaver || {})) opgaver[task] = addUsage(opgaver[task], u);
    dage.set(dato, { ...addUsage(cur, d), id: dato, dato, opgaver });
  }
  return [...dage.values()].sort((a, b) => (a.id < b.id ? 1 : -1));
}

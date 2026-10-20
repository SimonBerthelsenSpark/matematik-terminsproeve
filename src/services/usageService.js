/**
 * Registrering af AI-forbrug (tokens og anslået pris).
 * - usageDaily/{YYYY-MM-DD}: forbrug pr. dag, også fordelt på opgavetype
 * - exams/{id}.usage: forbrug pr. prøve (retning, spørgsmål og forklaringer)
 * Tallene lægges til med increment(), så samtidige kald ikke overskriver hinanden.
 */
import { collection, doc, getDocs, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase.js';
import { normalizeUsage, dagNoegle } from '../utils/usage.js';

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
  const writes = [
    setDoc(doc(db, 'usageDaily', dag), {
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

/** Alle dage med forbrug, nyeste først. */
export async function getDailyUsage() {
  const snap = await getDocs(collection(db, 'usageDaily'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.id < b.id ? 1 : -1));
}

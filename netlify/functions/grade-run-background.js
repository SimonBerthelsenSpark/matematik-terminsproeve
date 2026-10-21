/**
 * Baggrundsfunktion: kører selve AI-retningen (op til 15 minutter).
 * Resultatet gemmes, så klienten kan hente det via grade-status.
 */
import { runTask } from '../lib/aiCore.js';
import { jobStore, payloadKey, stateKey, JOB_ID } from '../lib/jobs.js';

// Lidt under Netlifys grænse på 15 minutter
const BACKGROUND_TIMEOUT_MS = 13 * 60 * 1000;

export default async (req) => {
  let id;
  try {
    ({ id } = await req.json());
  } catch {
    return;
  }
  if (!JOB_ID.test(String(id))) return;

  const store = jobStore();
  const job = await store.get(payloadKey(id), { type: 'json' });
  if (!job) return; // Ukendt eller allerede kørt job

  await store.setJSON(stateKey(id), { state: 'running', startedAt: Date.now(), uid: job.uid });

  let outcome;
  try {
    outcome = await runTask(job.task, job.payload, BACKGROUND_TIMEOUT_MS);
  } catch (err) {
    console.error('Baggrundsretning fejlede:', err);
    outcome = { statusCode: 500, body: { success: false, error: 'Intern fejl ved retning' } };
  }

  await store.setJSON(stateKey(id), {
    state: outcome.statusCode === 200 ? 'done' : 'error',
    statusCode: outcome.statusCode,
    response: outcome.body,
    finishedAt: Date.now(),
    uid: job.uid
  });
  // Elevens tekst skal ikke ligge længere end nødvendigt
  await store.delete(payloadKey(id));
};

export const config = { background: true };

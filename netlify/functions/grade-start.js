/**
 * Start et retningsjob. Gemmer opgaven og sætter baggrundsfunktionen i gang.
 * Svarer straks med 202 og et jobId, som klienten spørger på via grade-status.
 */
import { originAllowed, validateTask } from '../lib/aiCore.js';
import { jobStore, payloadKey, stateKey, jsonResponse } from '../lib/jobs.js';

export default async (req) => {
  if (req.method !== 'POST') return jsonResponse(405, { success: false, error: 'Kun POST er tilladt' });
  // Samme site er altid tilladt. Netlifys URL-variabler findes ikke altid i nye funktioner,
  // så vi sammenligner med den adresse, forespørgslen kom ind på.
  const selfOrigin = new URL(req.url).origin;
  if (!originAllowed(req.headers.get('origin'), selfOrigin)) return jsonResponse(403, { success: false, error: 'Ukendt oprindelse' });
  if (!process.env.OPENAI_API_KEY) return jsonResponse(500, { success: false, error: 'OPENAI_API_KEY er ikke sat på serveren' });

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, error: 'Ugyldig JSON' });
  }

  const problem = validateTask(body.task, body.payload);
  if (problem) return jsonResponse(400, { success: false, error: problem });

  const id = crypto.randomUUID();
  const store = jobStore();
  await store.setJSON(payloadKey(id), { task: body.task, payload: body.payload || {} });
  await store.setJSON(stateKey(id), { state: 'queued', createdAt: Date.now() });

  const base = new URL(req.url).origin;
  const res = await fetch(`${base}/.netlify/functions/grade-run-background`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  if (res.status !== 202) {
    await store.delete(payloadKey(id));
    await store.delete(stateKey(id));
    console.error(`Baggrundsfunktionen kunne ikke startes: ${res.status}`);
    return jsonResponse(502, { success: false, error: 'Retningen kunne ikke startes' });
  }

  return jsonResponse(202, { success: true, jobId: id });
};

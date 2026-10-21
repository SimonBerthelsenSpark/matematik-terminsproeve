/**
 * Status for et retningsjob. Når jobbet er færdigt, returneres resultatet én gang og slettes.
 */
import { jobStore, payloadKey, stateKey, JOB_ID, MAX_JOB_AGE_MS, jsonResponse } from '../lib/jobs.js';
import { verifyUser } from '../lib/auth.js';

export default async (req) => {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!JOB_ID.test(id)) return jsonResponse(400, { success: false, error: 'Ugyldigt job-id' });

  let user;
  try {
    user = await verifyUser(req.headers.get('authorization'));
  } catch (err) {
    return jsonResponse(err.status || 401, { success: false, error: err.message });
  }

  const store = jobStore();
  const state = await store.get(stateKey(id), { type: 'json' });
  // Andres job behandles som ukendte
  if (!state || (state.uid && state.uid !== user.uid)) return jsonResponse(404, { success: false, error: 'Jobbet findes ikke' });

  if (state.state === 'done' || state.state === 'error') {
    await store.delete(stateKey(id));
    return jsonResponse(200, { state: state.state, statusCode: state.statusCode, response: state.response });
  }

  const since = state.startedAt || state.createdAt || 0;
  if (Date.now() - since > MAX_JOB_AGE_MS) {
    await store.delete(stateKey(id));
    await store.delete(payloadKey(id));
    return jsonResponse(200, { state: 'error', statusCode: 504, response: { success: false, error: 'Retningen tog for lang tid' } });
  }

  return jsonResponse(200, { state: state.state, elapsedMs: Date.now() - (state.createdAt || since) });
};

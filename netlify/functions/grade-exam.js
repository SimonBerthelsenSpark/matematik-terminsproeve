/**
 * grade-exam – synkron variant (bruges kun til hurtige kald og som reserve).
 * Selve retningen kører som baggrundsjob: grade-start → grade-run-background → grade-status.
 */
import { runTask, originAllowed, json, TASKS, InputError, buildOpenAIBody, isReasoningModel } from '../lib/aiCore.js';
import { verifyUser } from '../lib/auth.js';

// Lidt under Netlifys tidsgrænse for synkrone funktioner, så vi kan svare pænt i stedet for en rå 504
const SYNC_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 25000;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { success: false, error: 'Kun POST er tilladt' });
  }
  const origin = event.headers.origin || event.headers.Origin;
  const host = event.headers.host || event.headers.Host;
  const selfOrigin = event.rawUrl ? new URL(event.rawUrl).origin : (host ? `https://${host}` : undefined);
  if (!originAllowed(origin, selfOrigin)) {
    return json(403, { success: false, error: 'Ukendt oprindelse' });
  }
  try {
    await verifyUser(event.headers.authorization || event.headers.Authorization);
  } catch (err) {
    return json(err.status || 401, { success: false, error: err.message });
  }
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { success: false, error: 'Ugyldig JSON' });
  }
  const { statusCode, body: out } = await runTask(body.task, body.payload, SYNC_TIMEOUT_MS);
  return json(statusCode, out);
};

// Eksporteres til tests
export const _internal = { TASKS, originAllowed, InputError, buildOpenAIBody, isReasoningModel };

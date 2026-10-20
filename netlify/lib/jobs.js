/**
 * Midlertidig lagring af retningsjob i Netlify Blobs.
 * Elevdata (payload) slettes, når jobbet er kørt; resultatet slettes, når klienten har hentet det.
 */
import { getStore } from '@netlify/blobs';

export const STORE_NAME = 'grading-jobs';
export const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const MAX_JOB_AGE_MS = 16 * 60 * 1000;

export const jobStore = () => getStore({ name: STORE_NAME, consistency: 'strong' });
export const payloadKey = (id) => `payload/${id}`;
export const stateKey = (id) => `state/${id}`;

export function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

/** Alle adresser, som dette site kan kaldes på. */
export function siteOrigins(req, context) {
  const out = new Set();
  const add = (value) => {
    if (!value) return;
    try {
      out.add(new URL(value.includes('://') ? value : `https://${value}`).origin);
    } catch {
      // ignorer ugyldige værdier
    }
  };
  add(req.url);
  add(req.headers.get('host'));
  add(req.headers.get('x-forwarded-host'));
  add(context?.url?.href);
  add(context?.site?.url);
  const env = (name) => globalThis.Netlify?.env?.get?.(name) || process.env[name];
  ['URL', 'DEPLOY_URL', 'DEPLOY_PRIME_URL'].forEach((k) => add(env(k)));
  (env('ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim()).forEach(add);
  return [...out];
}

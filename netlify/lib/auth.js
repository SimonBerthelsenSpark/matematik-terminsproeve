/**
 * Kun indloggede, godkendte lærere må bruge AI-funktionerne.
 * Firebase ID-tokens verificeres mod Googles offentlige nøgler (ingen hemmeligheder på serveren).
 * Godkendelse slås op i Firestore (brugere/{email}) med lærerens eget token, så sikkerhedsreglerne gælder.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

const env = (name) => globalThis.Netlify?.env?.get?.(name) || process.env[name];
const projectId = () => env('FIREBASE_PROJECT_ID') || 'retopgave';
const adminEmails = () => (env('ADMIN_EMAILS') || 's.berhelsen@gmail.com,simonberthelsen@hotmail.com')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

let jwks;
const getJwks = () => (jwks ??= createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
));

// Godkendte e-mails huskes kort, så hvert statuskald ikke slår op i Firestore
const godkendtCache = new Map();
const CACHE_MS = 5 * 60 * 1000;

/** Kun til tests: brug egne nøgler i stedet for Googles. */
export function _setJwksForTests(keyset) {
  jwks = keyset;
  godkendtCache.clear();
}

export class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function erGodkendt(email, token) {
  if (adminEmails().includes(email)) return true;
  const cached = godkendtCache.get(email);
  if (cached && cached > Date.now()) return true;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/brugere/${encodeURIComponent(email)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.ok) {
    godkendtCache.set(email, Date.now() + CACHE_MS);
    return true;
  }
  return false;
}

/**
 * @param {string|null|undefined} authorization - Authorization-headeren
 * @returns {Promise<{ uid: string, email: string }>}
 */
export async function verifyUser(authorization) {
  const token = /^Bearer\s+(.+)$/i.exec(authorization || '')?.[1];
  if (!token) throw new AuthError(401, 'Du er ikke logget ind. Log ind igen.');
  let payload;
  try {
    ({ payload } = await jwtVerify(token, getJwks(), {
      issuer: `https://securetoken.google.com/${projectId()}`,
      audience: projectId()
    }));
  } catch {
    throw new AuthError(401, 'Dit login er udløbet. Log ind igen.');
  }
  const email = String(payload.email || '').toLowerCase();
  if (!payload.sub || !email) throw new AuthError(401, 'Ugyldigt login.');
  if (payload.email_verified !== true) throw new AuthError(403, 'Bekræft din e-mail først.');
  if (!(await erGodkendt(email, token))) throw new AuthError(403, 'Din konto er ikke godkendt.');
  return { uid: payload.sub, email };
}

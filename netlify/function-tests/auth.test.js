import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { generateKeyPair, SignJWT, exportJWK, createLocalJWKSet } from 'jose';
import { verifyUser, _setJwksForTests } from '../lib/auth.js';

const PROJECT = 'retopgave';
let privateKey;

beforeAll(async () => {
  const kp = await generateKeyPair('RS256');
  privateKey = kp.privateKey;
  const jwk = { ...(await exportJWK(kp.publicKey)), kid: 'k1', alg: 'RS256' };
  _setJwksForTests(createLocalJWKSet({ keys: [jwk] }));
});
afterEach(() => vi.unstubAllGlobals());

const token = (claims = {}, opts = {}) => new SignJWT({ email: 'laerer@skole.dk', email_verified: true, ...claims })
  .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
  .setIssuer(opts.iss || `https://securetoken.google.com/${PROJECT}`)
  .setAudience(opts.aud || PROJECT)
  .setSubject('uid-123')
  .setIssuedAt()
  .setExpirationTime(opts.exp || '1h')
  .sign(privateKey);

describe('verifyUser', () => {
  it('afviser manglende token', async () => {
    await expect(verifyUser(null)).rejects.toMatchObject({ status: 401 });
  });

  it('godtager en godkendt lærer (slår op i brugere med lærerens token)', async () => {
    const f = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', f);
    const t = await token();
    await expect(verifyUser(`Bearer ${t}`)).resolves.toEqual({ uid: 'uid-123', email: 'laerer@skole.dk' });
    expect(f.mock.calls[0][0]).toContain('/documents/brugere/laerer%40skole.dk');
    expect(f.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${t}`);
  });

  it('afviser en lærer, der ikke er godkendt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(verifyUser(`Bearer ${await token({ email: 'ny@skole.dk' })}`)).rejects.toMatchObject({ status: 403 });
  });

  it('afviser ubekræftet e-mail', async () => {
    await expect(verifyUser(`Bearer ${await token({ email_verified: false })}`)).rejects.toMatchObject({ status: 403 });
  });

  it('afviser token fra et andet projekt', async () => {
    await expect(verifyUser(`Bearer ${await token({}, { aud: 'andet', iss: 'https://securetoken.google.com/andet' })}`)).rejects.toMatchObject({ status: 401 });
  });

  it('administrator er altid godkendt', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    await expect(verifyUser(`Bearer ${await token({ email: 'S.Berhelsen@gmail.com' })}`)).resolves.toMatchObject({ email: 's.berhelsen@gmail.com' });
    expect(f).not.toHaveBeenCalled();
  });
});

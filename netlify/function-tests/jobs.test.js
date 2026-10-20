import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// In-memory erstatning for Netlify Blobs
const mem = new Map();
vi.mock('@netlify/blobs', () => ({
  getStore: () => ({
    setJSON: async (k, v) => { mem.set(k, JSON.parse(JSON.stringify(v))); },
    get: async (k) => (mem.has(k) ? mem.get(k) : null),
    delete: async (k) => { mem.delete(k); }
  })
}));

const { default: start } = await import('../functions/grade-start.js');
const { default: run, config: runConfig } = await import('../functions/grade-run-background.js');
const { default: status } = await import('../functions/grade-status.js');

const ORIGIN = 'https://min-site.netlify.app';
const post = (url, body, origin = ORIGIN) =>
  new Request(url, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('baggrundsretning', () => {
  beforeEach(() => {
    mem.clear();
    process.env.OPENAI_API_KEY = 'test';
    process.env.URL = ORIGIN;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('er konfigureret som baggrundsfunktion', () => {
    expect(runConfig.background).toBe(true);
  });

  it('kører et helt job: start → baggrund → status (og sletter elevdata)', async () => {
    const openai = { ok: true, status: 200, json: async () => ({ model: 'gpt-6.1-sol', usage: { prompt_tokens: 1, completion_tokens: 1 }, choices: [{ message: { content: '{"opgaver":[],"karakterBegrundelse":"","samletFeedback":""}' }, finish_reason: 'stop' }] }) };
    let backgroundCall;
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (String(url).includes('grade-run-background')) { backgroundCall = JSON.parse(init.body); return { status: 202 }; }
      return openai;
    }));

    const res = await start(post(`${ORIGIN}/.netlify/functions/grade-start`, { task: 'gradeMath', payload: { rettevejledning: 'R', elevbesvarelse: 'E' } }));
    expect(res.status).toBe(202);
    const { jobId } = await res.json();
    expect(backgroundCall.id).toBe(jobId);

    const queued = await (await status(new Request(`${ORIGIN}/.netlify/functions/grade-status?id=${jobId}`))).json();
    expect(queued.state).toBe('queued');

    await run(post(`${ORIGIN}/.netlify/functions/grade-run-background`, { id: jobId }));
    expect(mem.has(`payload/${jobId}`)).toBe(false);

    const done = await (await status(new Request(`${ORIGIN}/.netlify/functions/grade-status?id=${jobId}`))).json();
    expect(done.state).toBe('done');
    expect(done.response.result.opgaver).toEqual([]);
    expect(done.response.model).toBe('gpt-6.1-sol');

    // Resultatet kan kun hentes én gang
    const gone = await status(new Request(`${ORIGIN}/.netlify/functions/grade-status?id=${jobId}`));
    expect(gone.status).toBe(404);
  });

  it('afviser ugyldige opgaver før der oprettes et job', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await start(post(`${ORIGIN}/.netlify/functions/grade-start`, { task: 'gradeMath', payload: {} }));
    expect(res.status).toBe(400);
    expect(mem.size).toBe(0);
  });

  it('tillader samme site, selvom URL-variablerne mangler', async () => {
    delete process.env.URL;
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 202 })));
    const site = 'https://lovely-lolly-f39ae9.netlify.app';
    const res = await start(post(`${site}/.netlify/functions/grade-start`, { task: 'ping' }, site));
    expect(res.status).toBe(202);
  });

  it('afviser fremmede origins', async () => {
    const res = await start(post(`${ORIGIN}/.netlify/functions/grade-start`, { task: 'ping' }, 'https://evil.example'));
    expect(res.status).toBe(403);
  });

  it('melder fejl fra AI videre via status', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => (String(url).includes('grade-run-background') ? { status: 202 } : { ok: false, status: 429, text: async () => 'rate' })));
    const res = await start(post(`${ORIGIN}/.netlify/functions/grade-start`, { task: 'ping' }));
    const { jobId } = await res.json();
    await run(post(`${ORIGIN}/x`, { id: jobId }));
    const out = await (await status(new Request(`${ORIGIN}/x?id=${jobId}`))).json();
    expect(out.state).toBe('error');
    expect(out.statusCode).toBe(429);
  });

  it('afviser ugyldige job-id', async () => {
    const res = await status(new Request(`${ORIGIN}/x?id=../../etc`));
    expect(res.status).toBe(400);
  });
});

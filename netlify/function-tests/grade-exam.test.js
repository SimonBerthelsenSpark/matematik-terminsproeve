import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handler, _internal } from '../functions/grade-exam.js';

const ORIGIN = 'https://min-site.netlify.app';

function event(body, { origin = ORIGIN, method = 'POST' } = {}) {
  return { httpMethod: method, headers: { origin }, body: JSON.stringify(body) };
}

function openaiOk(content, finish_reason = 'stop') {
  return {
    ok: true,
    status: 200,
    json: async () => ({ model: 'gpt-4o-2024-08-06', usage: { prompt_tokens: 10, completion_tokens: 5 }, choices: [{ message: { content }, finish_reason }] })
  };
}

describe('grade-exam', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test';
    process.env.URL = ORIGIN;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('afviser rå prompts (den gamle åbne proxy)', async () => {
    const res = await handler(event({ systemPrompt: 'Skriv et digt', userPrompt: 'nu', apiProvider: 'openai' }));
    expect(res.statusCode).toBe(400);
  });

  it('afviser fremmede origins', async () => {
    const res = await handler(event({ task: 'ping' }, { origin: 'https://evil.example' }));
    expect(res.statusCode).toBe(403);
  });

  it('tillader localhost', () => {
    expect(_internal.originAllowed('http://localhost:8888')).toBe(true);
  });

  it('validerer input-størrelse', async () => {
    const res = await handler(event({ task: 'gradeMath', payload: { rettevejledning: 'x'.repeat(90000), elevbesvarelse: 'y' } }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/for langt/);
  });

  it('sender gradeMath til gpt-6.1-sol med json_schema og reasoning_effort', async () => {
    const fetchMock = vi.fn().mockResolvedValue(openaiOk(JSON.stringify({ opgaver: [], karakterBegrundelse: '', samletFeedback: '' })));
    vi.stubGlobal('fetch', fetchMock);

    const res = await handler(event({ task: 'gradeMath', payload: { rettevejledning: 'R', elevbesvarelse: 'E' } }));
    expect(res.statusCode).toBe(200);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.model).toBe('gpt-6.1-sol');
    expect(sent.reasoning_effort).toBe('low');
    expect(sent.max_completion_tokens).toBeGreaterThan(10000);
    expect(sent.temperature).toBeUndefined();
    expect(sent.max_tokens).toBeUndefined();
    expect(sent.response_format.type).toBe('json_schema');
    expect(sent.response_format.json_schema.strict).toBe(true);
    expect(sent.response_format.json_schema.schema.properties.opgaver.items.required).toContain('usikker');
    expect(JSON.parse(res.body).result).toEqual({ opgaver: [], karakterBegrundelse: '', samletFeedback: '' });
  });

  it('bruger temperature 0 og max_tokens for gpt-4o', () => {
    const body = _internal.buildOpenAIBody('gpt-4o', { messages: [], maxTokens: 123, reasoningMaxTokens: 999 });
    expect(body.temperature).toBe(0);
    expect(body.max_tokens).toBe(123);
    expect(body.reasoning_effort).toBeUndefined();
  });

  it('falder tilbage til gpt-4o hvis hovedmodellen afvises', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'model not found' })
      .mockResolvedValueOnce(openaiOk('OK'));
    vi.stubGlobal('fetch', fetchMock);
    const res = await handler(event({ task: 'ping' }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe('gpt-4o');
  });

  it('sender billeder som image_url i Vision', async () => {
    const fetchMock = vi.fn().mockResolvedValue(openaiOk('{"opgaver":[],"karakterBegrundelse":"","samletFeedback":""}'));
    vi.stubGlobal('fetch', fetchMock);
    await handler(event({ task: 'gradeMath', payload: { rettevejledning: 'R', elevbesvarelse: 'E', pdfImages: ['data:image/jpeg;base64,AAAA'] } }));
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.messages[1].content[1].type).toBe('image_url');
  });

  it('afviser ikke-billeder i pdfImages', async () => {
    const res = await handler(event({ task: 'gradeMath', payload: { rettevejledning: 'R', elevbesvarelse: 'E', pdfImages: ['https://evil/x.png'] } }));
    expect(res.statusCode).toBe(400);
  });

  it('melder afkortet svar som fejl', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(openaiOk('{"opg', 'length')));
    const res = await handler(event({ task: 'gradeMath', payload: { rettevejledning: 'R', elevbesvarelse: 'E' } }));
    expect(res.statusCode).toBe(422);
  });

  it('videresender 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => 'rate' }));
    const res = await handler(event({ task: 'ping' }));
    expect(res.statusCode).toBe(429);
  });

  it('bygger dansk prompt med kriterie-id', () => {
    const req = _internal.TASKS.gradeDansk({
      elevbesvarelse: 'tekst',
      dele: [{ navn: 'Del A', kriterier: [{ id: 'K1', navn: 'Indhold', beskrivelse: 'b' }] }]
    });
    expect(req.messages[1].content).toContain('[K1] Indhold');
    expect(req.schema.schema.properties.kriterier.items.properties.delKarakter.enum).toEqual([-3, 0, 2, 4, 7, 10, 12]);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateGradingResult, kriterieListe, calculateLaererGrading } from './hooks/useDanskGrading.js';
import { efterbehandlMatematik } from './hooks/useGradingLogic.js';
import { fjernElevnavn, navnFraFilnavn, calculateCost, callAI } from './services/aiService.js';

const SKEMA = {
  dele: [
    { navn: 'Del A', totalVaegt: 50, kriterier: [{ navn: 'Indhold', vaegt: 30 }, { navn: 'Struktur', vaegt: 20 }] },
    { navn: 'Del B', totalVaegt: 50, kriterier: [{ navn: 'Sprog', vaegt: 50 }] }
  ]
};

describe('Dansk: kriterier matches på id', () => {
  it('giver hvert kriterium et id', () => {
    expect(kriterieListe(SKEMA).map(k => k.id)).toEqual(['K1', 'K2', 'K3']);
  });

  it('matcher korrekt selv når AI svarer i en anden rækkefølge', () => {
    const ai = {
      kriterier: [
        { id: 'K3', delKarakter: 12, feedback: 'sprog' },
        { id: 'K1', delKarakter: 4, feedback: 'indhold' },
        { id: 'K2', delKarakter: 7, feedback: 'struktur' }
      ],
      samletVurdering: 'ok'
    };
    const r = calculateGradingResult(SKEMA, ai, '1_Anna.docx', '1_Anna');
    expect(r.dele[0].kriterier[0]).toMatchObject({ navn: 'Indhold', delKarakter: 4 });
    expect(r.dele[0].kriterier[1]).toMatchObject({ navn: 'Struktur', delKarakter: 7 });
    expect(r.dele[1].kriterier[0]).toMatchObject({ navn: 'Sprog', delKarakter: 12 });
    // (4*30 + 7*20 + 12*50) / 100 = 8.6 → 10
    expect(r.samletKarakter).toBeCloseTo(8.6);
    expect(r.afrundetKarakter).toBe(10);
  });

  it('fejler tydeligt hvis AI mangler et kriterium', () => {
    const ai = { kriterier: [{ id: 'K1', delKarakter: 4, feedback: '' }], samletVurdering: '' };
    expect(() => calculateGradingResult(SKEMA, ai, 'x', 'x')).toThrow(/Struktur/);
  });

  it('fejler på ugyldig karakter i stedet for at sætte 0', () => {
    const ai = {
      kriterier: [
        { id: 'K1', delKarakter: 5, feedback: '' },
        { id: 'K2', delKarakter: 7, feedback: '' },
        { id: 'K3', delKarakter: 7, feedback: '' }
      ]
    };
    expect(() => calculateGradingResult(SKEMA, ai, 'x', 'x')).toThrow(/Ugyldig karakter/);
  });

  it('beregner lærerens justering', () => {
    const ai = calculateGradingResult(SKEMA, {
      kriterier: [
        { id: 'K1', delKarakter: 4, feedback: '' },
        { id: 'K2', delKarakter: 4, feedback: '' },
        { id: 'K3', delKarakter: 4, feedback: '' }
      ]
    }, 'x', 'x');
    const laerer = calculateLaererGrading(ai, { 1: { 0: 12 } });
    // (4*30 + 4*20 + 12*50)/100 = 8 → 7
    expect(laerer.samletKarakter).toBeCloseTo(8);
    expect(laerer.afrundetKarakter).toBe(7);
  });
});

describe('Matematik: efterbehandling', () => {
  const tabel = [
    { karakter: -3, minPoint: 0, maxPoint: 0 },
    { karakter: 0, minPoint: 1, maxPoint: 12 },
    { karakter: 2, minPoint: 13, maxPoint: 20 },
    { karakter: 4, minPoint: 21, maxPoint: 36 },
    { karakter: 7, minPoint: 37, maxPoint: 51 },
    { karakter: 10, minPoint: 52, maxPoint: 64 },
    { karakter: 12, minPoint: 65, maxPoint: 75 }
  ];

  it('beregner total og karakter i koden', () => {
    const r = efterbehandlMatematik({
      opgaver: [
        { nummer: '1', givetPoint: 30, maxPoint: 40 },
        { nummer: '2', givetPoint: 10, maxPoint: 35 }
      ]
    }, tabel);
    expect(r.totalPoint).toBe(40);
    expect(r.karakter).toBe(7);
    expect(r.advarsler).toEqual([]);
  });

  it('klemmer point der overstiger maxPoint og advarer', () => {
    const r = efterbehandlMatematik({
      opgaver: [{ nummer: '1', givetPoint: 9, maxPoint: 5 }, { nummer: '2', givetPoint: 0, maxPoint: 70 }]
    }, tabel);
    expect(r.opgaver[0].givetPoint).toBe(5);
    expect(r.totalPoint).toBe(5);
    expect(r.advarsler.length).toBe(1);
  });

  it('advarer når summen af maxPoint ikke passer med tabellen', () => {
    const r = efterbehandlMatematik({ opgaver: [{ nummer: '1', givetPoint: 5, maxPoint: 10 }] }, tabel);
    expect(r.advarsler.some(a => a.includes('maksimum'))).toBe(true);
  });
});

describe('Pseudonymisering', () => {
  it('udleder navn fra filnavn', () => {
    expect(navnFraFilnavn('12_Søren Hansen.pdf')).toBe('Søren Hansen');
    expect(navnFraFilnavn('Anna_Marie.docx')).toBe('Anna Marie');
  });

  it('fjerner fulde navn og navnedele', () => {
    const t = 'Navn: Søren Hansen. Søren svarer 42. SØREN skrev også.';
    expect(fjernElevnavn(t, 'Søren Hansen')).toBe('Navn: [ELEV]. [ELEV] svarer 42. [ELEV] skrev også.');
  });

  it('rammer ikke ord der blot indeholder navnet', () => {
    expect(fjernElevnavn('Hansen og Hans', 'Hans')).toBe('Hansen og [ELEV]');
  });

  it('ignorerer meget korte navnedele', () => {
    expect(fjernElevnavn('Bo ser en bog', 'Bo')).toBe('[ELEV] ser en bog');
    expect(fjernElevnavn('Bo ser en bog', 'Bo Li Andersen')).toBe('Bo ser en bog');
  });
});

describe('aiService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('beregner pris', () => {
    expect(calculateCost({ prompt_tokens: 1e6, completion_tokens: 1e6 }, 'gpt-4o-2024-08-06')).toBe(12.5);
    expect(calculateCost({ prompt_tokens: 1e6, completion_tokens: 1e6 }, 'gpt-6.1-sol')).toBe(12);
  });

  it('kører et baggrundsjob og prøver igen ved 502', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      // 1. forsøg: start fejler med 502
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ success: false, error: 'AI-tjenesten svarede 500' }) })
      // 2. forsøg: start OK, første poll kører stadig, anden poll færdig
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ success: true, jobId: 'abc' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ state: 'running' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ state: 'done', response: { success: true, result: { x: 1 }, usage: null, model: 'gpt-6.1-sol' } }) });
    vi.stubGlobal('fetch', fetchMock);

    const onRetry = vi.fn();
    const onProgress = vi.fn();
    const promise = callAI('ping', {}, { onRetry, onProgress });
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.result).toEqual({ x: 1 });
    expect(res.model).toBe('gpt-6.1-sol');
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ task: 'ping', payload: {} });
    expect(fetchMock.mock.calls[2][0]).toContain('grade-status?id=abc');
    vi.useRealTimers();
  });

  it('prøver ikke igen ved 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ success: false, error: 'Feltet "x" mangler' }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(callAI('gradeMath', {})).rejects.toThrow('Feltet "x" mangler');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import { sammenlignRetninger, dobbeltRetningAdvarsler } from './hooks/useGradingLogic.js';

describe('Matematik: dobbeltretning', () => {
  const op = (nummer, givetPoint, extra = {}) => ({ nummer, givetPoint, maxPoint: 2, feedback: `fb ${nummer}`, usikker: false, usikkerhed: '', ...extra });

  it('markerer opgaver hvor de to retninger er uenige', () => {
    const a = { opgaver: [op('1.1', 2), op('1.2', 1), op('2', 0)] };
    const b = { opgaver: [op('1.1', 2), op('1.2', 2, { feedback: 'Metode ok' }), op('2', 0)] };
    const { result, uenigheder } = sammenlignRetninger(a, b);
    expect(uenigheder).toBe(1);
    expect(result.opgaver[0].usikker).toBe(false);
    expect(result.opgaver[1].usikker).toBe(true);
    expect(result.opgaver[1].givetPoint).toBe(1); // første retning bruges
    expect(result.opgaver[1].usikkerhed).toContain('1 og 2 point');
    expect(result.opgaver[1].usikkerhed).toContain('Metode ok');
    expect(result.dobbeltRetning).toMatchObject({ total1: 3, total2: 4, uenigheder: 1 });
  });

  it('matcher opgaver på nummer uanset skrivemåde og rækkefølge', () => {
    const a = { opgaver: [op('Opgave 1.1', 2), op('1.2', 1)] };
    const b = { opgaver: [op('1.2', 1), op('1.1', 2)] };
    expect(sammenlignRetninger(a, b).uenigheder).toBe(0);
  });

  it('markerer opgaver der kun findes i den ene retning', () => {
    const a = { opgaver: [op('1', 1)] };
    const b = { opgaver: [op('1', 1), op('2', 2)] };
    const { result, uenigheder } = sammenlignRetninger(a, b);
    expect(uenigheder).toBe(1);
    expect(dobbeltRetningAdvarsler(result.dobbeltRetning).join(' ')).toContain('opgave 2');

    const { result: r2 } = sammenlignRetninger(b, a);
    expect(r2.opgaver[1].usikker).toBe(true);
    expect(r2.opgaver[1].usikkerhed).toContain('fandt ikke');
  });

  it('bevarer AI\'ens egen usikkerhed', () => {
    const a = { opgaver: [op('1', 1, { usikker: true, usikkerhed: 'Ulæselig' })] };
    const b = { opgaver: [op('1', 2)] };
    const o = sammenlignRetninger(a, b).result.opgaver[0];
    expect(o.usikkerhed).toContain('Ulæselig');
    expect(o.usikkerhed).toContain('1 og 2');
  });

  it('advarer når kun én retning lykkedes', () => {
    expect(dobbeltRetningAdvarsler({ enkelt: 'timeout' })[0]).toContain('Kun rettet én gang');
    expect(dobbeltRetningAdvarsler(undefined)).toEqual([]);
  });

  it('efterbehandlingen viser uenighed som advarsel', () => {
    const a = { opgaver: [op('1', 1)] };
    const b = { opgaver: [op('1', 2)] };
    const res = efterbehandlMatematik(sammenlignRetninger(a, b).result, [{ karakter: 2, minPoint: 0, maxPoint: 2 }]);
    expect(res.advarsler.some(x => x.includes('1 og 2 point'))).toBe(true);
  });
});

describe('Matematik: sidetal', () => {
  it('beholder gyldige sidetal og fjerner 0', () => {
    const res = efterbehandlMatematik({ opgaver: [
      { nummer: '1', side: 3, givetPoint: 1, maxPoint: 1 },
      { nummer: '2', side: 0, givetPoint: 0, maxPoint: 1 }
    ] }, [{ karakter: 2, minPoint: 0, maxPoint: 2 }]);
    expect(res.opgaver.map(o => o.side)).toEqual([3, null]);
  });
});

import { setUsageRecorder } from './services/aiService.js';

describe('Forbrug registreres', () => {
  afterEach(() => setUsageRecorder(null));

  it('sender task, prøve og usage videre efter et vellykket kald', async () => {
    vi.useFakeTimers();
    const usage = { prompt_tokens: 1000, completion_tokens: 200 };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ success: true, jobId: 'j1' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ state: 'done', response: { success: true, result: {}, usage, model: 'gpt-6.1-sol' } }) }));
    const rec = vi.fn();
    setUsageRecorder(rec);
    const p = callAI('explainTask', {}, { examId: 'e1' });
    await vi.runAllTimersAsync();
    await p;
    expect(rec).toHaveBeenCalledWith(expect.objectContaining({ task: 'explainTask', examId: 'e1', usage, model: 'gpt-6.1-sol' }));
    vi.useRealTimers();
  });

  it('en fejl i registreringen stopper ikke kaldet', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ success: true, jobId: 'j2' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ state: 'done', response: { success: true, result: { ok: 1 }, usage: null, model: 'm' } }) }));
    setUsageRecorder(() => { throw new Error('offline'); });
    const p = callAI('ping', {});
    await vi.runAllTimersAsync();
    expect((await p).result).toEqual({ ok: 1 });
    vi.useRealTimers();
  });
});

describe('Genoptag job efter genindlæsning', () => {
  const lager = () => {
    const m = new Map();
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m };
  };

  it('henter et igangværende job i stedet for at starte et nyt', async () => {
    vi.useFakeTimers();
    const ls = lager();
    ls.setItem('aiJob:e1:s1:gradeMath:1', JSON.stringify({ jobId: 'gammel', startedAt: Date.now() }));
    vi.stubGlobal('localStorage', ls);
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ state: 'done', response: { success: true, result: { r: 1 }, usage: null, model: 'm' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const p = callAI('gradeMath', {}, { resumeKey: 'e1:s1:gradeMath:1' });
    await vi.runAllTimersAsync();
    expect((await p).result).toEqual({ r: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('grade-status?id=gammel');
    expect(ls._m.size).toBe(0);
    vi.useRealTimers();
  });

  it('starter forfra, hvis det gamle job er væk', async () => {
    vi.useFakeTimers();
    const ls = lager();
    ls.setItem('aiJob:k', JSON.stringify({ jobId: 'vaek', startedAt: Date.now() }));
    vi.stubGlobal('localStorage', ls);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ success: true, jobId: 'ny' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ state: 'done', response: { success: true, result: 2, usage: null, model: 'm' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const p = callAI('gradeMath', {}, { resumeKey: 'k' });
    await vi.runAllTimersAsync();
    expect((await p).result).toBe(2);
    expect(fetchMock.mock.calls[1][0]).toContain('grade-start');
    vi.useRealTimers();
  });

  it('husker jobbet mens det kører', async () => {
    vi.useFakeTimers();
    const ls = lager();
    vi.stubGlobal('localStorage', ls);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ success: true, jobId: 'j9' }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ state: 'running' }) }));
    callAI('gradeMath', {}, { resumeKey: 'x' }).catch(() => {});
    await vi.advanceTimersByTimeAsync(3000);
    expect(JSON.parse(ls.getItem('aiJob:x')).jobId).toBe('j9');
    vi.useRealTimers();
  });
});

import { kortHash } from './hooks/useGradingLogic.js';

describe('Ingen elevnavne i browserens lager', () => {
  it('nøglen indeholder ikke navnet', () => {
    const h = kortHash('5_Emma Pedersen');
    expect(h).not.toMatch(/emma|pedersen/i);
    expect(kortHash('5_Emma Pedersen')).toBe(h);
    expect(kortHash('6_Frederik Møller')).not.toBe(h);
  });
});

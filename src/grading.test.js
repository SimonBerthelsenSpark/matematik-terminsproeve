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
  });

  it('prøver igen ved 502 og lykkes', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ success: false, error: 'AI-tjenesten svarede 500' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, result: { x: 1 }, usage: null, model: 'gpt-4o' }) });
    vi.stubGlobal('fetch', fetchMock);

    const onRetry = vi.fn();
    const promise = callAI('ping', {}, { onRetry });
    await vi.runAllTimersAsync();
    const res = await promise;

    expect(res.result).toEqual({ x: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ task: 'ping', payload: {} });
    vi.useRealTimers();
  });

  it('prøver ikke igen ved 400', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ success: false, error: 'Feltet "x" mangler' }) });
    vi.stubGlobal('fetch', fetchMock);
    await expect(callAI('gradeMath', {})).rejects.toThrow('Feltet "x" mangler');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

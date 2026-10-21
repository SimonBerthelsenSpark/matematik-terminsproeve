import { describe, it, expect } from 'vitest';
import {
  roundTo7trins,
  formatKarakter,
  extractNumbers,
  parseOmsaetningstabel,
  lookupKarakter,
  validateTabel,
  totalVaegt,
  vaegteSummererTil100,
  beregnVaegtetKarakter
} from './karakter.js';

const FP_TABEL = [
  { karakter: -3, minPoint: 0, maxPoint: 0 },
  { karakter: 0, minPoint: 1, maxPoint: 12 },
  { karakter: 2, minPoint: 13, maxPoint: 20 },
  { karakter: 4, minPoint: 21, maxPoint: 36 },
  { karakter: 7, minPoint: 37, maxPoint: 51 },
  { karakter: 10, minPoint: 52, maxPoint: 64 },
  { karakter: 12, minPoint: 65, maxPoint: 75 }
];

describe('roundTo7trins', () => {
  it('runder til nærmeste trin', () => {
    expect(roundTo7trins(6.2)).toBe(7);
    expect(roundTo7trins(1.1)).toBe(2);
    expect(roundTo7trins(0.9)).toBe(0);
    expect(roundTo7trins(-2)).toBe(-3);
    expect(roundTo7trins(11.4)).toBe(12);
  });
  it('runder ned ved lige stor afstand (ROUND_TIES_UP = false)', () => {
    expect(roundTo7trins(5.5)).toBe(4);
    expect(roundTo7trins(8.5)).toBe(7);
  });
  it('håndterer ugyldigt input', () => {
    expect(roundTo7trins(NaN)).toBe(-3);
  });
});

describe('formatKarakter', () => {
  it('viser 00 og 02', () => {
    expect(formatKarakter(0)).toBe('00');
    expect(formatKarakter(2)).toBe('02');
    expect(formatKarakter(-3)).toBe('-3');
  });
});

describe('extractNumbers', () => {
  it('læser "- 3" som minus tre', () => {
    expect(extractNumbers('Point - 3 0 0')).toEqual([-3, 0, 0]);
  });
  it('læser "13-20" og "13 - 20" som intervaller', () => {
    expect(extractNumbers('02 13-20 4 21 - 36')).toEqual([2, 13, 20, 4, 21, 36]);
  });
  it('bevarer minus efter mellemrum', () => {
    expect(extractNumbers('02 00 -3')).toEqual([2, 0, -3]);
  });
  it('forstår unicode-minus', () => {
    expect(extractNumbers('−3 0 0')).toEqual([-3, 0, 0]);
  });
});

describe('parseOmsaetningstabel', () => {
  it('læser formatet fra PDF-udtræk (fejlen hvor -3 blev til 3)', () => {
    const text = 'Karakter Point - 3 0 0 00 1 12 02 13 20 4 21 36 7 37 51 10 52 64 12 65 75';
    expect(parseOmsaetningstabel(text)).toEqual(FP_TABEL);
  });
  it('læser intervaller med bindestreg', () => {
    const text = 'Karakter Point\n-3 0-0\n00 1-12\n02 13-20\n4 21-36\n7 37-51\n10 52-64\n12 65-75';
    expect(parseOmsaetningstabel(text)).toEqual(FP_TABEL);
  });
  it('læser faldende rækkefølge', () => {
    const text = 'Karakter Point 12 65-75 10 52-64 7 37-51 4 21-36 02 13-20 00 1-12 -3 0-0';
    expect(parseOmsaetningstabel(text)).toEqual(FP_TABEL);
  });
  it('læser kolonne-layout (alle karakterer først)', () => {
    const text = 'Karakter -3 00 02 4 7 10 12 Point 0-0 1-12 13-20 21-36 37-51 52-64 65-75';
    expect(parseOmsaetningstabel(text)).toEqual(FP_TABEL);
  });
  it('ignorerer årstal i overskriften', () => {
    const text = 'FP9 maj 2025\nKarakter Point -3 0 0 00 1 12 02 13 20 4 21 36 7 37 51 10 52 64 12 65 75';
    expect(parseOmsaetningstabel(text)).toEqual(FP_TABEL);
  });
  it('returnerer null for tekst uden tabel', () => {
    expect(parseOmsaetningstabel('Ingen tabel her 1 2 3')).toBeNull();
  });
});

describe('lookupKarakter', () => {
  it('slår hele point op', () => {
    expect(lookupKarakter(FP_TABEL, 0)).toBe(-3);
    expect(lookupKarakter(FP_TABEL, 1)).toBe(0);
    expect(lookupKarakter(FP_TABEL, 36)).toBe(4);
    expect(lookupKarakter(FP_TABEL, 37)).toBe(7);
    expect(lookupKarakter(FP_TABEL, 75)).toBe(12);
  });
  it('håndterer halve point mellem to intervaller', () => {
    expect(lookupKarakter(FP_TABEL, 12.5)).toBe(0);
    expect(lookupKarakter(FP_TABEL, 36.5)).toBe(4);
  });
  it('virker med kun minimumspoint og usorteret input', () => {
    const tabel = [...FP_TABEL].reverse().map(r => ({ karakter: r.karakter, minPoint: r.minPoint }));
    expect(lookupKarakter(tabel, 50)).toBe(7);
  });
  it('returnerer null for tom tabel', () => {
    expect(lookupKarakter([], 10)).toBeNull();
  });
});

describe('validateTabel', () => {
  it('godkender en korrekt tabel', () => {
    expect(validateTabel(FP_TABEL).valid).toBe(true);
  });
  it('afviser faldende karakterer', () => {
    const bad = [{ karakter: 7, minPoint: 0 }, { karakter: 4, minPoint: 10 }];
    expect(validateTabel(bad).valid).toBe(false);
  });
});

describe('vægte', () => {
  const skema = {
    dele: [
      { kriterier: [{ vaegt: 30 }, { vaegt: 20 }] },
      { kriterier: [{ vaegt: 50 }] }
    ]
  };
  it('summerer kriterievægte', () => {
    expect(totalVaegt(skema)).toBe(100);
    expect(vaegteSummererTil100(skema)).toBe(true);
  });
  it('opdager skæve vægte', () => {
    expect(vaegteSummererTil100({ dele: [{ kriterier: [{ vaegt: 40 }] }] })).toBe(false);
  });
  it('beregner vægtet karakter', () => {
    const r = beregnVaegtetKarakter([
      { vaegt: 50, delKarakter: 7 },
      { vaegt: 50, delKarakter: 12 }
    ]);
    expect(r.samletKarakter).toBe(9.5);
    expect(r.afrundetKarakter).toBe(10);
  });
  it('normaliserer når vægtene ikke summerer til 100', () => {
    const r = beregnVaegtetKarakter([
      { vaegt: 30, delKarakter: 10 },
      { vaegt: 30, delKarakter: 10 }
    ]);
    expect(r.samletKarakter).toBe(10);
  });
});

import { normalizeUsage, addUsage, totalTokens, formatTokensKort, dagNoegle, resultatForbrug, formatKr } from './usage.js';

describe('forbrug', () => {
  it('normaliserer OpenAI-usage', () => {
    expect(normalizeUsage({ prompt_tokens: 100, completion_tokens: 50, completion_tokens_details: { reasoning_tokens: 30 }, prompt_tokens_details: { cached_tokens: 10 } }))
      .toEqual({ inputTokens: 100, outputTokens: 50, reasoningTokens: 30, cachedTokens: 10 });
    expect(normalizeUsage(null)).toEqual({ inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cachedTokens: 0 });
  });
  it('lægger forbrug sammen', () => {
    const s = addUsage({ calls: 1, inputTokens: 10, outputTokens: 5, cost: 0.1 }, null, { calls: 1, inputTokens: 20, cost: 0.2 });
    expect(s.calls).toBe(2);
    expect(totalTokens(s)).toBe(35);
    expect(s.cost).toBeCloseTo(0.3);
  });
  it('formaterer', () => {
    expect(formatTokensKort(1500)).toBe('1,5 k');
    expect(formatTokensKort(2500000)).toBe('2,5 mio.');
    expect(formatKr(1)).toBe('7,00 kr.');
    expect(dagNoegle(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('håndterer gamle resultater uden tokens', () => {
    expect(resultatForbrug({ apiCost: 0.5 })).toEqual({ usage: null, cost: 0.5, harTokens: false });
    expect(resultatForbrug({ metadata: { usage: { inputTokens: 5, outputTokens: 5, cost: 0.01 } } }).harTokens).toBe(true);
  });
});

import { navneKandidater, findNavneSpans, erstatNavne, rektanglerForItem } from './redact.js';

describe('navne fjernes', () => {
  it('finder hele navnet og navnedele, også med danske bogstaver fra translittererede filnavne', () => {
    const k = navneKandidater('Soeren_Hansen');
    expect(k).toEqual(expect.arrayContaining(['Soeren Hansen', 'Søren Hansen', 'Søren', 'Hansen']));
  });
  it('rammer kun hele ord', () => {
    expect(findNavneSpans('Hansen og Hansensvej', navneKandidater('Bo Hansen'))).toEqual([{ start: 0, end: 6 }]);
  });
  it('erstatter navne i tekst', () => {
    expect(erstatNavne('Navn: Søren Hansen. Søren svarer 12.', 'Soeren Hansen')).toBe('Navn: [ELEV]. [ELEV] svarer 12.');
  });
  it('beregner et felt over navnet i et tekstelement', () => {
    // 10 tegn bredt element på 100 px, skrifthøjde 10 px, navnet står på tegn 6–10
    const r = rektanglerForItem({ str: 'Navn: Emma', width: 100, transform: [] }, [10, 0, 0, 10, 50, 200], 1, navneKandidater('Emma Berg'));
    expect(r).toHaveLength(1);
    expect(r[0].x).toBeLessThan(110);
    expect(r[0].x + r[0].w).toBeGreaterThanOrEqual(150);
    expect(r[0].y).toBeLessThan(190);
  });
});

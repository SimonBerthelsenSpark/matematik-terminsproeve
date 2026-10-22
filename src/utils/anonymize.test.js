import { describe, it, expect } from 'vitest';
import { foreslaaFelter, tilWinAnsi, synligTekst, overlapper, klip } from './anonymize.js';
import { parseElevliste, standardAlias } from '../components/ClassManagement.jsx';

const item = (str, x, y, w = 0.3, h = 0.02) => ({ str, x, y, w, h, fontPt: 12 });
const side = (nr, items) => ({ nr, bredde: 595, hoejde: 842, items });

describe('forslag til sorte felter', () => {
  it('dækker resten af en "Navn:"-linje', () => {
    const felter = foreslaaFelter([side(1, [item('Navn: Anna Jensen', 0.1, 0.05), item('Opgave 1: 3/4', 0.1, 0.2)])]);
    expect(felter).toHaveLength(1);
    expect(felter[0].grund).toBe('navnelinje');
    expect(felter[0].x).toBeGreaterThan(0.1);
    expect(felter[0].y).toBeLessThan(0.06);
  });

  it('dækker ord til højre for en etiket, der står alene', () => {
    const felter = foreslaaFelter([side(1, [item('Navn:', 0.1, 0.05, 0.05), item('Bo', 0.3, 0.05, 0.04), item('Opgave 1', 0.1, 0.3)])]);
    expect(felter.some(f => f.x > 0.29 && f.x < 0.31)).toBe(true);
  });

  it('dækker plads til et håndskrevet navn, når etiketten er alene på linjen', () => {
    const felter = foreslaaFelter([side(1, [item('Navn:', 0.1, 0.05, 0.05), item('Opgave 1 med en lang tekst om procent', 0.1, 0.3)])]);
    expect(felter.find(f => f.grund === 'håndskrift')).toBeTruthy();
  });

  it('finder elevens alias i teksten', () => {
    const felter = foreslaaFelter([side(1, [item('Lavet af Lynet i 9.A og mere tekst her', 0.1, 0.5)])], ['Lynet']);
    expect(felter.filter(f => f.grund === 'navn')).toHaveLength(1);
  });

  it('dækker toppen af en scannet side uden tekst', () => {
    const felter = foreslaaFelter([side(1, []), side(2, [])]);
    expect(felter).toEqual([expect.objectContaining({ side: 1, x: 0, y: 0, w: 1, grund: 'scannet' })]);
  });
});

describe('anonymiseret tekst', () => {
  it('tekst under et sort felt kommer ikke med', () => {
    const s = side(1, [item('Navn: Anna', 0.1, 0.05), item('Svar: 12', 0.1, 0.3)]);
    const synlig = synligTekst(s, [{ side: 1, x: 0, y: 0, w: 1, h: 0.1 }]);
    expect(synlig.map(i => i.str)).toEqual(['Svar: 12']);
  });

  it('dækker et felt kun en del af linjen, fjernes kun den del', () => {
    // 10 tegn, felt over de sidste 4 (uden målefunktion fordeles tegnene ligeligt)
    const s = side(1, [item('Svar 12 Bo', 0.1, 0.3, 0.5)]);
    const [ud] = synligTekst(s, [{ side: 1, x: 0.1 + 0.5 * 0.7, y: 0.25, w: 0.4, h: 0.1 }]);
    expect(ud.str).toBe('Svar 12 [dækket]');
  });

  it('felter på andre sider påvirker ikke', () => {
    const s = side(2, [item('Svar', 0.1, 0.05)]);
    expect(synligTekst(s, [{ side: 1, x: 0, y: 0, w: 1, h: 1 }])).toHaveLength(1);
  });

  it('tegn uden for standardskriften erstattes', () => {
    expect(tilWinAnsi('x² − 4 ≤ π æøå')).toBe('x² - 4 <= pi æøå');
    expect(tilWinAnsi('∫')).toBe('?');
  });

  it('geometri', () => {
    expect(overlapper({ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.4, y: 0.4, w: 0.2, h: 0.2 })).toBe(true);
    expect(overlapper({ x: 0, y: 0, w: 0.1, h: 0.1 }, { x: 0.5, y: 0.5, w: 0.2, h: 0.2 })).toBe(false);
    expect(klip({ x: -0.1, y: 0.9, w: 0.5, h: 0.5 })).toEqual({ x: 0, y: 0.9, w: 0.5, h: expect.closeTo(0.1, 5) });
  });
});

describe('klasser uden navne', () => {
  it('et tal alene giver standard-alias', () => {
    expect(parseElevliste('1\n2 Lynet\n3')).toEqual([
      { studentNumber: '1', studentName: 'Elev 1' },
      { studentNumber: '2', studentName: 'Lynet' },
      { studentNumber: '3', studentName: 'Elev 3' }
    ]);
    expect(standardAlias(7)).toBe('Elev 7');
  });
});

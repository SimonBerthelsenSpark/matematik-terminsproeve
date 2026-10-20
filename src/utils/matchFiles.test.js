import { describe, it, expect } from 'vitest';
import { matchFilesToStudents, checkSubmissionFile, isRealPdf, validateSubmissionFile } from './matchFiles.js';

const S = [
  { id: 'a', studentNumber: '1', studentName: 'Anna Jensen' },
  { id: 'b', studentNumber: '2', studentName: 'Anna Marie Holm' },
  { id: 'c', studentNumber: '3', studentName: 'Frederik Møller' },
  { id: 'd', studentNumber: '12', studentName: 'Bo Nielsen' }
];
const f = (name) => ({ name, size: 100 });

describe('matchFilesToStudents', () => {
  it('matcher på fulde navn, også med æøå og understreger', () => {
    const { matches } = matchFilesToStudents([f('frederik_moeller_mat.pdf'), f('Anna Jensen.pdf')], S);
    expect(matches.map(m => m.student.id)).toEqual(['c', 'a']);
  });
  it('foretrækker det længste navn', () => {
    const { matches } = matchFilesToStudents([f('Anna Marie Holm.docx')], S);
    expect(matches[0].student.id).toBe('b');
  });
  it('matcher på elevnummer', () => {
    const { matches } = matchFilesToStudents([f('12 - besvarelse.pdf')], S);
    expect(matches[0].student.id).toBe('d');
  });
  it('matcher entydigt fornavn, men ikke tvetydigt', () => {
    const r = matchFilesToStudents([f('bo.pdf'), f('anna.pdf')], S);
    expect(r.matches.map(m => m.student.id)).toEqual(['d']);
    expect(r.unmatched.map(x => x.name)).toEqual(['anna.pdf']);
  });
  it('bruger ikke samme elev to gange', () => {
    const r = matchFilesToStudents([f('Bo Nielsen.pdf'), f('Bo Nielsen (1).pdf')], S);
    expect(r.matches.length).toBe(1);
    expect(r.unmatched.length).toBe(1);
  });
});

describe('PDF-tjek', () => {
  const blob = (name, text) => new File([text], name, { type: 'application/pdf' });
  it('afviser andet end PDF', () => {
    expect(checkSubmissionFile(f('x.docx'))).toMatch(/ikke en PDF/);
    expect(checkSubmissionFile(f('x.PDF'))).toBeNull();
  });
  it('genkender en rigtig PDF på indholdet', async () => {
    expect(await isRealPdf(blob('a.pdf', '%PDF-1.7\n...'))).toBe(true);
    expect(await validateSubmissionFile(blob('a.pdf', '%PDF-1.4 x'))).toBeNull();
  });
  it('afviser en omdøbt Word-fil', async () => {
    expect(await validateSubmissionFile(blob('a.pdf', 'PK\u0003\u0004word/document.xml'))).toMatch(/ikke en rigtig PDF/);
  });
  it('afviser tomme filer', async () => {
    expect(await validateSubmissionFile(blob('a.pdf', ''))).toMatch(/tom/);
  });
});

import { describe, it, expect } from 'vitest';
import { matchFilesToStudents, checkSubmissionFile } from './matchFiles.js';

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

describe('checkSubmissionFile', () => {
  it('afviser forkerte filtyper', () => {
    expect(checkSubmissionFile(f('x.doc'))).toMatch(/kun PDF/);
    expect(checkSubmissionFile(f('x.PDF'))).toBeNull();
  });
});

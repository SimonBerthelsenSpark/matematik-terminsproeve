/**
 * Opret den fiktive eksempelprøve for den indloggede lærer:
 * klassen "Eksempel 9.X" med tre elever, prøven og materialet (rettevejledning + omsætningstabel).
 * Besvarelserne uploader læreren selv, så anonymiseringen også afprøves.
 */
import { createExam, updateExam, updateExamFileRef } from './firestoreService.js';
import { createClass, getAllClasses, getStudents, addStudent } from './classService.js';
import { uploadExamFile } from './storageService.js';

export const EKSEMPEL_KLASSE = 'Eksempel 9.X';

export const EKSEMPEL_TABEL = [
  { karakter: 12, minPoint: 27, maxPoint: 30 },
  { karakter: 10, minPoint: 23, maxPoint: 26 },
  { karakter: 7, minPoint: 17, maxPoint: 22 },
  { karakter: 4, minPoint: 12, maxPoint: 16 },
  { karakter: 2, minPoint: 8, maxPoint: 11 },
  { karakter: 0, minPoint: 3, maxPoint: 7 },
  { karakter: -3, minPoint: 0, maxPoint: 2 }
];

async function hentFil(sti, navn) {
  const res = await fetch(sti);
  if (!res.ok) throw new Error(`${navn} kunne ikke hentes (${res.status})`);
  const blob = await res.blob();
  return new File([blob], navn, { type: 'application/pdf' });
}

/** @returns {Promise<string>} prøvens id */
export async function opretEksempelproeve(onStatus) {
  onStatus?.('Opretter klassen…');
  const klasser = await getAllClasses();
  let klasse = klasser.find(k => k.className === EKSEMPEL_KLASSE);
  const klasseId = klasse ? klasse.id : await createClass({ className: EKSEMPEL_KLASSE });
  const elever = await getStudents(klasseId);
  for (const nr of ['1', '2', '3']) {
    if (!elever.some(e => String(e.studentNumber) === nr)) {
      await addStudent(klasseId, { studentNumber: nr, studentName: `Elev ${nr}` });
    }
  }

  onStatus?.('Opretter prøven…');
  const examId = await createExam({
    beskrivelse: 'Eksempel: terminsprøve i matematik',
    dato: new Date(),
    klasse: EKSEMPEL_KLASSE,
    type: 'Matematik'
  });
  await updateExam(examId, { eksempel: true, omsaetningstabelData: EKSEMPEL_TABEL });

  onStatus?.('Uploader materialet…');
  const rv = await uploadExamFile(examId, await hentFil('/eksempel/rettevejledning.pdf', 'rettevejledning.pdf'), 'rettevejledning');
  await updateExamFileRef(examId, 'rettevejledningRef', rv);
  const ot = await uploadExamFile(examId, await hentFil('/eksempel/omsaetningstabel.pdf', 'omsaetningstabel.pdf'), 'omsætningstabel');
  await updateExamFileRef(examId, 'omsætningstabelRef', ot);

  return examId;
}

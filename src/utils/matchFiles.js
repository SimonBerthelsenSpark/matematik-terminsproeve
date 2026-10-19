/**
 * Match uploadede filer til elever ud fra filnavnet.
 * Virker med fx "Anna Jensen.pdf", "anna_jensen_matematik.docx", "3 - Clara Hansen.pdf" eller "3_Clara.pdf".
 */

const norm = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

export function matchFilesToStudents(files, students) {
  const used = new Set();
  const matches = [];
  const unmatched = [];

  for (const file of files) {
    const base = norm(file.name.replace(/\.[^/.]+$/, ''));
    const padded = ` ${base} `;

    // 1) Fulde navn i filnavnet (længste navn først, så "Anna Marie" vinder over "Anna")
    let student = [...students]
      .sort((a, b) => b.studentName.length - a.studentName.length)
      .find(s => !used.has(s.id) && padded.includes(` ${norm(s.studentName)} `));

    // 2) Elevnummer først i filnavnet
    if (!student) {
      const m = base.match(/^(\d+)\b/);
      if (m) student = students.find(s => !used.has(s.id) && String(Number(s.studentNumber)) === String(Number(m[1])));
    }

    // 3) Entydigt fornavn
    if (!student) {
      const kandidater = students.filter(s => !used.has(s.id) && padded.includes(` ${norm(s.studentName.split(' ')[0])} `));
      if (kandidater.length === 1) student = kandidater[0];
    }

    if (student) {
      used.add(student.id);
      matches.push({ file, student });
    } else {
      unmatched.push(file);
    }
  }
  return { matches, unmatched };
}

export const ACCEPTED_SUBMISSION = ['.pdf', '.docx', '.txt'];
export const MAX_SUBMISSION_BYTES = 20 * 1024 * 1024;

export function checkSubmissionFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!ACCEPTED_SUBMISSION.includes(ext)) return `${file.name}: kun PDF, Word (.docx) og tekstfiler kan rettes`;
  if (file.size > MAX_SUBMISSION_BYTES) return `${file.name} er større end 20 MB`;
  return null;
}

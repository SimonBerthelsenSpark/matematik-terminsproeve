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

// Besvarelser skal være PDF – det giver den mest pålidelige retning (tekst + billeder af siderne)
export const ACCEPTED_SUBMISSION = ['.pdf'];
export const MAX_SUBMISSION_BYTES = 20 * 1024 * 1024;
export const PDF_HJAELP = 'Gem filen som PDF først: I Word vælg Filer → Gem som → PDF. I Google Docs vælg Filer → Download → PDF.';

/** Hurtigt tjek af filnavn og størrelse. */
export function checkSubmissionFile(file) {
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!ACCEPTED_SUBMISSION.includes(ext)) return `${file.name} er ikke en PDF`;
  if (file.size > MAX_SUBMISSION_BYTES) return `${file.name} er større end 20 MB`;
  if (file.size === 0) return `${file.name} er tom`;
  return null;
}

/** Er filen en rigtig PDF? Tjekker filens første bytes ("%PDF-"), ikke kun navnet. */
export async function isRealPdf(file) {
  try {
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    const text = String.fromCharCode(...head);
    return text.includes('%PDF-');
  } catch {
    return false;
  }
}

/** Fuldt tjek før upload. Returnerer en fejltekst eller null. */
export async function validateSubmissionFile(file) {
  const quick = checkSubmissionFile(file);
  if (quick) return quick;
  if (!(await isRealPdf(file))) return `${file.name} hedder .pdf, men er ikke en rigtig PDF`;
  return null;
}

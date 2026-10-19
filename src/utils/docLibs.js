/**
 * Lazy-loading af de tunge dokumentbiblioteker (pdf.js og mammoth).
 * De hentes først, når der faktisk skal læses en fil, så forsiden loader hurtigere.
 * pdf.js-workeren bundles lokalt i stedet for at hentes fra et CDN.
 */

let pdfjsPromise = null;
let mammothPromise = null;

export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.js?url')
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export function loadMammoth() {
  if (!mammothPromise) {
    mammothPromise = import('mammoth').then(m => m.default || m);
  }
  return mammothPromise;
}

/**
 * Udtræk tekst fra en PDF (File eller Blob).
 */
export async function extractPdfText(file) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
  }
  return fullText.trim();
}

/**
 * Udtræk tekst fra et Word-dokument (.docx).
 */
export async function extractWordText(file) {
  const mammoth = await loadMammoth();
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return (result.value || '').trim();
}

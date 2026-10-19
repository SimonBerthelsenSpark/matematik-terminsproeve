/**
 * PDF → billeder til Vision.
 * Holder samlet størrelse under et budget, så forespørgslen ikke rammer
 * Netlifys grænse for request-størrelse (ca. 6 MB).
 */

import { loadPdfjs } from './docLibs.js';

/** Samlet budget for alle billeder (tegn i base64 data-URL'er). */
export const IMAGE_BUDGET_CHARS = 4.2 * 1024 * 1024;

/**
 * Konverter en PDF til base64 JPEG-billeder (én pr. side).
 * Hvis billederne bliver for store, sænkes kvaliteten. Til sidst stoppes der
 * ved budgettet, så resten af siderne kun sendes som tekst.
 * @param {File|Blob} pdfFile
 * @param {Object} [options]
 * @param {number} [options.scale=1.5]
 * @param {number} [options.maxPages=10]
 * @param {number} [options.quality=0.7]
 * @param {number} [options.budgetChars=IMAGE_BUDGET_CHARS]
 * @returns {Promise<{ images: string[], totalPages: number, truncated: boolean }>}
 */
export async function convertPDFToImages(pdfFile, options = {}) {
  const {
    scale = 1.5,
    maxPages = 10,
    quality = 0.7,
    budgetChars = IMAGE_BUDGET_CHARS
  } = options;

  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await pdfFile.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const numPages = Math.min(pdf.numPages, maxPages);

  // Startkvalitet pr. side – sænkes hvis vi nærmer os budgettet
  const perPageBudget = budgetChars / Math.max(1, numPages);

  const images = [];
  let total = 0;
  let truncated = pdf.numPages > maxPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    let q = quality;
    let dataUrl = canvas.toDataURL('image/jpeg', q);
    while (dataUrl.length > perPageBudget && q > 0.35) {
      q -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', q);
    }
    canvas.width = 0;
    canvas.height = 0;

    if (total + dataUrl.length > budgetChars) {
      truncated = true;
      break;
    }
    images.push(dataUrl);
    total += dataUrl.length;
  }

  return { images, totalPages: pdf.numPages, truncated };
}

/**
 * Skal Vision bruges for denne fil?
 * @param {Object} exam - prøven (enableVision)
 * @param {File|Blob} file
 */
export function shouldUseVision(exam, file) {
  if (!exam?.enableVision) return false;
  if (!file || file.type !== 'application/pdf') return false;
  return file.size <= 20 * 1024 * 1024;
}

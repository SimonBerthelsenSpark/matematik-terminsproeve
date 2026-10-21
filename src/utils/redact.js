/**
 * Find elevens navn i en tekst, så det kan dækkes på billeder af siderne.
 * Samme regler som fjernElevnavn: hele navnet og hver navnedel på mindst 3 bogstaver,
 * kun hele ord (så "Hans" ikke rammer "Hansen"), uden forskel på store og små bogstaver.
 */
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Filnavne kan være translittererede (Søren → Soeren), så begge stavemåder søges
const MED_DANSKE_BOGSTAVER = (s) => s.replace(/oe/gi, m => (m[0] === 'O' ? 'Ø' : 'ø'))
  .replace(/aa/gi, m => (m[0] === 'A' ? 'Å' : 'å'))
  .replace(/ae/gi, m => (m[0] === 'A' ? 'Æ' : 'æ'));

export function navneKandidater(elevNavn) {
  const fuldt = String(elevNavn || '').replace(/_/g, ' ').trim();
  if (!fuldt) return [];
  const dele = fuldt.split(/\s+/).filter(d => d.length >= 3);
  const alle = [fuldt, ...dele].flatMap(n => [n, MED_DANSKE_BOGSTAVER(n)]);
  return [...new Set(alle)].sort((a, b) => b.length - a.length);
}

/** Erstat elevens navn i en tekst med [ELEV]. */
export function erstatNavne(text, elevNavn) {
  const kandidater = navneKandidater(elevNavn);
  const spans = findNavneSpans(text, kandidater);
  if (!spans.length) return text;
  let out = '';
  let pos = 0;
  for (const { start, end } of spans) {
    out += text.slice(pos, start) + '[ELEV]';
    pos = end;
  }
  return out + text.slice(pos);
}

/** @returns {{ start: number, end: number }[]} tegn-intervaller, der skal dækkes */
export function findNavneSpans(text, kandidater) {
  const spans = [];
  if (!text || !kandidater?.length) return spans;
  for (const navn of kandidater) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(navn)}(?![\\p{L}\\p{N}])`, 'giu');
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;
      if (!spans.some(s => start < s.end && end > s.start)) spans.push({ start, end });
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

/**
 * Rektangler (i canvas-pixels) der dækker navnet i ét tekstelement fra pdf.js.
 * @param {{ str: string, width: number, transform: number[] }} item
 * @param {number[]} m - viewport.transform ganget med item.transform (pdfjs.Util.transform)
 * @param {number} scale - viewport.scale
 */
export function rektanglerForItem(item, m, scale, kandidater, maal = null) {
  const spans = findNavneSpans(item.str, kandidater);
  if (!spans.length) return [];
  const fontH = Math.hypot(m[2], m[3]);
  const bredde = (item.width || 0) * scale || fontH * 0.55 * item.str.length;
  // Placering i teksten: målt med en almindelig skrift (maal), ellers ligeligt fordelt pr. tegn
  const total = maal ? maal(item.str) : item.str.length;
  const pos = (i) => (total > 0 ? (bredde * (maal ? maal(item.str.slice(0, i)) : i)) / total : 0);
  const padX = Math.max(3, fontH * 0.35);
  const padY = Math.max(2, fontH * 0.15);
  return spans.map(({ start, end }) => ({
    x: m[4] + pos(start) - padX,
    y: m[5] - fontH - padY,
    w: pos(end) - pos(start) + padX * 2,
    h: fontH * 1.3 + padY * 2
  }));
}

/**
 * Anonymisering af elevbesvarelser, før de forlader lærerens computer.
 *
 * 1) Siderne læses med pdf.js, og appen foreslår sorte felter (alias, "Navn:"-linjer, toppen af en
 *    side uden tekst – typisk et håndskrevet navn).
 * 2) Læreren tilføjer/fjerner felter.
 * 3) Der laves en NY PDF, hvor hver side er et billede med felterne brændt ind. Tekst, der ligger under
 *    et felt, kommer ikke med; den øvrige tekst lægges usynligt ind, så den stadig kan læses af appen.
 *
 * Alle koordinater er normaliserede (0–1) i forhold til sidens bredde og højde, med (0,0) øverst til venstre.
 */
import { loadPdfjs } from './docLibs.js';
import { navneKandidater, findNavneSpans } from './redact.js';

const MAX_SIDER = 30;

/** Læs PDF'en: sider, størrelser og tekstelementer med placering. */
export async function laesPdf(file) {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const sider = [];
  for (let n = 1; n <= Math.min(pdf.numPages, MAX_SIDER); n++) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const tekst = await page.getTextContent();
    const items = [];
    for (const item of tekst.items) {
      if (!item.str || !item.str.trim()) continue;
      const m = pdfjs.Util.transform(vp.transform, item.transform);
      const h = Math.hypot(m[2], m[3]) || 10;
      const w = item.width || h * 0.5 * item.str.length;
      items.push({
        str: item.str,
        x: m[4] / vp.width,
        y: (m[5] - h) / vp.height,
        w: w / vp.width,
        h: (h * 1.2) / vp.height,
        fontPt: h
      });
    }
    sider.push({ nr: n, bredde: vp.width, hoejde: vp.height, items });
  }
  return { pdf, sider, totalSider: pdf.numPages };
}

/** Tegn en side til et canvas i den ønskede skala. */
export async function tegnSide(pdf, nr, scale) {
  const page = await pdf.getPage(nr);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(vp.width);
  canvas.height = Math.ceil(vp.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return canvas;
}

let maaler;
function maal(t) {
  if (!maaler && typeof document !== 'undefined') {
    maaler = document.createElement('canvas').getContext('2d');
    maaler.font = '100px Helvetica, Arial, sans-serif';
  }
  return maaler ? maaler.measureText(t).width : t.length;
}

/** Del af et tekstelement (fra tegn a til b) som rektangel. */
function delAfItem(item, a, b, pad = 0.004) {
  const total = maal(item.str) || 1;
  const x0 = item.x + (item.w * maal(item.str.slice(0, a))) / total;
  const x1 = item.x + (item.w * maal(item.str.slice(0, b))) / total;
  return { x: x0 - pad, y: item.y - pad, w: x1 - x0 + pad * 2, h: item.h + pad * 2 };
}

const NAVN_LABEL = /(?<![\p{L}])(navn|name|elevnavn|underskrift)(?![\p{L}])\s*[:.]?/iu;

/**
 * Foreslå sorte felter.
 * @param {Array} sider - fra laesPdf
 * @param {string[]} kendteNavne - alias og evt. andre ord, der skal dækkes
 */
export function foreslaaFelter(sider, kendteNavne = []) {
  const felter = [];
  const kandidater = kendteNavne.flatMap(navneKandidater);
  const tilfoej = (side, r, grund) => felter.push({ side, ...klip(r), auto: true, grund, id: nyId() });

  for (const s of sider) {
    for (const item of s.items) {
      // 1) Kendte navne/alias i teksten
      for (const { start, end } of findNavneSpans(item.str, kandidater)) {
        tilfoej(s.nr, delAfItem(item, start, end), 'navn');
      }
      // 2) "Navn: …" – dæk resten af linjen efter etiketten
      const m = NAVN_LABEL.exec(item.str);
      if (m) {
        const efter = m.index + m[0].length;
        const linje = s.items.filter(o => o !== item && Math.abs(o.y - item.y) < item.h * 0.6 && o.x > item.x);
        const resten = item.str.slice(efter).trim();
        if (resten) tilfoej(s.nr, delAfItem(item, efter, item.str.length), 'navnelinje');
        linje.forEach(o => tilfoej(s.nr, { x: o.x - 0.004, y: o.y - 0.004, w: o.w + 0.008, h: o.h + 0.008 }, 'navnelinje'));
        if (!resten && linje.length === 0) {
          // Etiketten står alene – navnet er sandsynligvis håndskrevet ved siden af
          const start = delAfItem(item, efter, efter);
          tilfoej(s.nr, { x: start.x, y: item.y - item.h * 0.5, w: Math.min(0.45, 0.98 - start.x), h: item.h * 2 }, 'håndskrift');
        }
      }
    }
  }

  // 3) Første side uden (næsten) tekst er scannet/håndskrevet – dæk toppen
  const foerste = sider[0];
  if (foerste && foerste.items.reduce((n, i) => n + i.str.trim().length, 0) < 30) {
    felter.push({ side: 1, ...topFelt(), auto: true, grund: 'scannet', id: nyId() });
  }
  return felter;
}

export const topFelt = () => ({ x: 0, y: 0, w: 1, h: 0.12 });

let tæller = 0;
export const nyId = () => `f${Date.now().toString(36)}${(tæller++).toString(36)}`;

export function klip(r) {
  const x = Math.max(0, Math.min(1, r.x));
  const y = Math.max(0, Math.min(1, r.y));
  return { x, y, w: Math.max(0, Math.min(1 - x, r.w)), h: Math.max(0, Math.min(1 - y, r.h)) };
}

export const overlapper = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Gør tekst kompatibel med standardskriften i PDF (WinAnsi). Ukendte tegn erstattes. */
export function tilWinAnsi(s) {
  const map = { '−': '-', '–': '-', '—': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '...', '√': 'kvrod', '≤': '<=', '≥': '>=', '≠': '!=', '≈': '~', 'π': 'pi', '∙': '*', '⋅': '*', '·': '*' };
  return Array.from(String(s)).map(c => {
    if (map[c]) return map[c];
    const k = c.codePointAt(0);
    return (k >= 0x20 && k <= 0x7e) || (k >= 0xa0 && k <= 0xff) ? c : '?';
  }).join('');
}

/**
 * Den tekst, der må komme med: alt, der ikke ligger under et sort felt.
 * Dækker et felt kun en del af en tekstlinje, fjernes kun de dækkede tegn (erstattet af "█").
 */
export function synligTekst(side, felter) {
  const mine = felter.filter(f => f.side === side.nr);
  const ud = [];
  for (const item of side.items) {
    const ramt = mine.filter(f => overlapper(item, f));
    if (!ramt.length) { ud.push(item); continue; }
    const tegn = Array.from(item.str);
    const total = maal(item.str) || 1;
    let foer = '';
    const rest = tegn.map((c) => {
      const x0 = item.x + (item.w * maal(foer)) / total;
      foer += c;
      const x1 = item.x + (item.w * maal(foer)) / total;
      const midt = (x0 + x1) / 2;
      return ramt.some(f => midt >= f.x && midt <= f.x + f.w) ? '\u0000' : c;
    }).join('').replace(/\u0000+/g, ' [dækket] ').replace(/\s+/g, ' ').trim();
    if (rest.replace(/\[dækket\]/g, '').trim()) ud.push({ ...item, str: rest });
  }
  return ud;
}

/**
 * Lav den anonymiserede PDF.
 * @returns {Promise<File>}
 */
export async function lavAnonymiseretPdf({ pdf, sider }, felter, filnavn, { scale = 1.75, kvalitet = 0.82 } = {}) {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const ud = await PDFDocument.create();
  ud.setTitle(filnavn.replace(/\.pdf$/i, ''));
  ud.setProducer('AI Prøveretter (anonymiseret)');
  ud.setCreator('AI Prøveretter');
  const font = await ud.embedFont(StandardFonts.Helvetica);

  for (const s of sider) {
    const canvas = await tegnSide(pdf, s.nr, scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    for (const f of felter.filter(f => f.side === s.nr)) {
      ctx.fillRect(Math.floor(f.x * canvas.width), Math.floor(f.y * canvas.height), Math.ceil(f.w * canvas.width) + 1, Math.ceil(f.h * canvas.height) + 1);
    }
    const jpg = await new Promise(res => canvas.toBlob(res, 'image/jpeg', kvalitet));
    canvas.width = 0;
    canvas.height = 0;
    const billede = await ud.embedJpg(new Uint8Array(await jpg.arrayBuffer()));
    const page = ud.addPage([s.bredde, s.hoejde]);
    page.drawImage(billede, { x: 0, y: 0, width: s.bredde, height: s.hoejde });

    // Usynlig tekst (kun det, der ikke er dækket), så besvarelsen stadig kan læses som tekst
    for (const item of synligTekst(s, felter)) {
      const tekst = tilWinAnsi(item.str);
      if (!tekst.trim()) continue;
      const size = Math.max(4, Math.min(48, item.fontPt));
      try {
        page.drawText(tekst, { x: item.x * s.bredde, y: s.hoejde - (item.y * s.hoejde + item.fontPt), size, font, opacity: 0 });
      } catch {
        // Tegn der ikke kan skrives, springes over
      }
    }
  }
  const bytes = await ud.save();
  return new File([bytes], filnavn, { type: 'application/pdf' });
}

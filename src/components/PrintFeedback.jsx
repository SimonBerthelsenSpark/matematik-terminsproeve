/**
 * Udskrift af point og feedback til eleverne – ét A4-ark pr. elev.
 * Brug: printFeedback([...ark]) – arkene laves med byggArk(). <PrintRoot/> skal være monteret én gang (main.jsx).
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { formatKarakter } from '../utils/karakter.js';
import { elevnavnFraFil, elevnummerFraFil, formatDato } from './ui.jsx';
import { Loader2 } from './Icons.jsx';

// ---------- Lille global tilstand, så print kan startes hvor som helst ----------
let arkTilPrint = null;
const lyttere = new Set();
const saet = (v) => { arkTilPrint = v; lyttere.forEach(fn => fn()); };
const abonner = (fn) => { lyttere.add(fn); return () => lyttere.delete(fn); };

export function printFeedback(ark) {
  if (ark?.length) saet(ark);
}

const fmt = (n) => (n === null || n === undefined || n === '' ? '–' : String(Math.round(Number(n) * 10) / 10).replace('.', ','));
const erGodkendt = (r) => (r.dele ? Boolean(r.lærerGrading) : r.lærerKarakter !== undefined && r.lærerKarakter !== null);

/**
 * Lav et elevark ud fra en retning.
 * @param {Object} r - resultat (matematik eller dansk)
 * @param {Object} exam - prøven
 * @param {{ kommentarer?: boolean }} [opts]
 */
export function byggArk(r, exam, { kommentarer = true } = {}) {
  const nr = elevnummerFraFil(r.elevNavn || r.fileName);
  const alias = elevnavnFraFil(r.elevNavn || r.fileName);
  const godkendt = erGodkendt(r);
  const faelles = {
    id: r.submissionId || r.id || r.elevNavn,
    titel: exam?.beskrivelse || 'Prøve',
    dato: exam?.dato ? formatDato(exam.dato) : '',
    klasse: exam?.klasse || '',
    elev: [nr ? `Elev ${nr}` : '', alias && alias !== `Elev ${nr}` ? alias : ''].filter(Boolean).join(' · ') || 'Elev',
    foreloebig: !godkendt,
    kommentarer
  };

  if (r.dele) {
    const base = r.lærerGrading || r;
    return {
      ...faelles,
      type: 'Dansk',
      karakter: base.afrundetKarakter,
      raekker: (base.dele || []).flatMap(del => (del.kriterier || []).map(k => ({
        gruppe: del.navn,
        label: k.navn,
        vaerdi: k.delKarakter === undefined || k.delKarakter === null ? '–' : formatKarakter(k.delKarakter),
        kommentar: k.lærerKommentar || k.feedback || ''
      }))),
      feedback: r.karakterBegrundelse || ''
    };
  }

  const opgaver = r.opgaver || [];
  const point = (o) => (o.lærerPoint !== undefined && o.lærerPoint !== null ? Number(o.lærerPoint) : Number(o.givetPoint) || 0);
  const total = godkendt && r.lærerTotalPoint !== undefined ? r.lærerTotalPoint : opgaver.reduce((s, o) => s + point(o), 0);
  return {
    ...faelles,
    type: 'Matematik',
    karakter: godkendt ? r.lærerKarakter : r.karakter,
    point: total,
    maxPoint: opgaver.reduce((s, o) => s + (Number(o.maxPoint) || 0), 0),
    raekker: opgaver.map(o => ({
      label: `Opgave ${o.nummer}`,
      vaerdi: `${fmt(point(o))} / ${fmt(o.maxPoint)}`,
      kommentar: o.feedback || ''
    })),
    feedback: r.samletFeedback || ''
  };
}

/** Monteres én gang. Viser kun noget ved udskrift. */
export function PrintRoot() {
  const ark = useSyncExternalStore(abonner, () => arkTilPrint, () => null);

  useEffect(() => {
    if (!ark) return;
    const efter = () => saet(null);
    window.addEventListener('afterprint', efter, { once: true });
    // Vent til arkene er tegnet, før printdialogen åbnes
    const t = setTimeout(() => window.print(), 150);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', efter); };
  }, [ark]);

  if (!ark) return null;
  return createPortal(
    <div id="print-root" lang="da">
      {ark.map(a => <Ark key={a.id} ark={a} />)}
    </div>,
    document.body
  );
}

function Ark({ ark }) {
  let sidsteGruppe = null;
  return (
    <section className="print-ark">
      <header className="print-hoved">
        <div>
          <p className="print-lille">{[ark.titel, ark.klasse && `Klasse ${ark.klasse}`, ark.dato].filter(Boolean).join(' · ')}</p>
          <h1>{ark.elev}</h1>
        </div>
        <div className="print-karakter">
          <span className="print-lille">Karakter{ark.foreloebig ? ' (foreløbig)' : ''}</span>
          <strong>{ark.karakter === undefined || ark.karakter === null ? '–' : formatKarakter(ark.karakter)}</strong>
          {ark.type === 'Matematik' && <span className="print-lille">{fmt(ark.point)} af {fmt(ark.maxPoint)} point</span>}
        </div>
      </header>

      <table className="print-tabel">
        <thead>
          <tr>
            <th>{ark.type === 'Dansk' ? 'Kriterium' : 'Opgave'}</th>
            <th className="print-tal">{ark.type === 'Dansk' ? 'Karakter' : 'Point'}</th>
            {ark.kommentarer && <th>Kommentar</th>}
          </tr>
        </thead>
        <tbody>
          {ark.raekker.map((r, i) => {
            const nyGruppe = r.gruppe && r.gruppe !== sidsteGruppe;
            sidsteGruppe = r.gruppe;
            return (
              <React.Fragment key={i}>
                {nyGruppe && <tr className="print-gruppe"><td colSpan={ark.kommentarer ? 3 : 2}>{r.gruppe}</td></tr>}
                <tr>
                  <td>{r.label}</td>
                  <td className="print-tal">{r.vaerdi}</td>
                  {ark.kommentarer && <td>{r.kommentar}</td>}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {ark.feedback && (
        <div className="print-feedback">
          <h2>Feedback</h2>
          <p>{ark.feedback}</p>
        </div>
      )}
    </section>
  );
}

/**
 * Dialog med valg før udskrift.
 * @param {{ results: Object[], exam: Object, enkelt?: boolean, onLuk: () => void }} props
 */
export function PrintDialog({ results, exam, enkelt = false, onLuk }) {
  const [kunGodkendte, setKunGodkendte] = useState(!enkelt);
  const [kommentarer, setKommentarer] = useState(true);
  const [busy, setBusy] = useState(false);
  const valgte = (results || []).filter(r => !r.error && (!kunGodkendte || erGodkendt(r)));
  const ikkeGodkendte = (results || []).filter(r => !r.error && !erGodkendt(r)).length;

  const print = () => {
    setBusy(true);
    const sorteret = [...valgte].sort((a, b) => (Number(elevnummerFraFil(a.elevNavn)) || 999) - (Number(elevnummerFraFil(b.elevNavn)) || 999));
    printFeedback(sorteret.map(r => byggArk(r, exam, { kommentarer })));
    onLuk();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 px-4" role="dialog" aria-modal="true" aria-labelledby="print-titel" onKeyDown={(e) => e.key === 'Escape' && onLuk()}>
      <div className="surface w-full max-w-md p-5 shadow-xl">
        <h2 id="print-titel" className="text-[17px] font-semibold">Print feedback til {enkelt ? 'eleven' : 'eleverne'}</h2>
        <p className="mt-1 text-sm text-ink-soft">Ét ark pr. elev med point, karakter og feedback. Vælg "Gem som PDF" i printdialogen, hvis du vil dele det digitalt.</p>
        <div className="mt-4 space-y-3">
          {!enkelt && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" className="mt-1 w-4 h-4 accent-[#1E2B3A]" checked={kunGodkendte} onChange={(e) => setKunGodkendte(e.target.checked)} />
              <span className="text-sm">
                <span className="font-semibold block">Kun godkendte karakterer</span>
                <span className="text-ink-soft">{ikkeGodkendte > 0 ? `${ikkeGodkendte} er ikke godkendt endnu. ` : ''}Ikke-godkendte markeres "foreløbig".</span>
              </span>
            </label>
          )}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 w-4 h-4 accent-[#1E2B3A]" checked={kommentarer} onChange={(e) => setKommentarer(e.target.checked)} />
            <span className="text-sm">
              <span className="font-semibold block">Kommentar pr. {exam?.type === 'Dansk' ? 'kriterium' : 'opgave'}</span>
              <span className="text-ink-soft">AI'ens begrundelse for pointene. Læs den igennem, før den gives til eleven.</span>
            </span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onLuk}>Annuller</button>
          <button type="button" className="btn-primary" onClick={print} disabled={busy || valgte.length === 0} autoFocus>
            {busy && <Loader2 />} Print {valgte.length} {valgte.length === 1 ? 'ark' : 'ark'}
          </button>
        </div>
      </div>
    </div>
  );
}

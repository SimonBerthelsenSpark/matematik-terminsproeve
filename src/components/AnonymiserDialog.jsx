/**
 * Læreren gennemser hver besvarelse og dækker alt, der kan afsløre eleven, før den uploades.
 * Kun den anonymiserede PDF forlader computeren.
 */
import React, { useEffect, useRef, useState } from 'react';
import { laesPdf, tegnSide, foreslaaFelter, lavAnonymiseretPdf, topFelt, nyId, klip } from '../utils/anonymize.js';
import { Loader2, X } from './Icons.jsx';

const VIS_SKALA = 1.4;

/**
 * @param {Object} props
 * @param {{ student: Object, file: Blob, filnavn: string }[]} props.koe - besvarelser der skal gennemses
 * @param {(item, anonymFil: File, info: { felter: number }) => Promise<void>} props.onGodkend - gem/upload
 * @param {() => void} props.onLuk - når køen er færdig eller annulleret
 */
export function AnonymiserDialog({ koe, onGodkend, onLuk }) {
  const [index, setIndex] = useState(0);
  const item = koe[index];
  const [data, setData] = useState(null); // { pdf, sider, totalSider, billeder: [] }
  const [felter, setFelter] = useState([]);
  const [fejl, setFejl] = useState(null);
  const [gemmer, setGemmer] = useState(false);
  const historik = useRef([]);
  const dialogRef = useRef(null);

  // Indlæs den aktuelle besvarelse
  useEffect(() => {
    let annulleret = false;
    setData(null);
    setFelter([]);
    setFejl(null);
    historik.current = [];
    (async () => {
      try {
        const doc = await laesPdf(item.file);
        const billeder = [];
        for (const s of doc.sider) {
          const c = await tegnSide(doc.pdf, s.nr, VIS_SKALA);
          billeder.push(c.toDataURL('image/jpeg', 0.85));
          c.width = 0;
          c.height = 0;
          if (annulleret) return;
        }
        if (annulleret) return;
        setData({ ...doc, billeder });
        setFelter(foreslaaFelter(doc.sider, [item.student?.studentName].filter(Boolean)));
      } catch (err) {
        if (!annulleret) setFejl(`PDF'en kunne ikke læses: ${err.message}`);
      }
    })();
    return () => { annulleret = true; };
  }, [item]);

  useEffect(() => { dialogRef.current?.focus(); }, [index]);

  const opdater = (fn) => {
    setFelter(prev => {
      historik.current.push(prev);
      return fn(prev);
    });
  };
  const fortryd = () => {
    const prev = historik.current.pop();
    if (prev) setFelter(prev);
  };

  const harTopFelt = felter.some(f => f.side === 1 && f.x === 0 && f.y === 0 && f.w === 1);
  const skiftTopFelt = () => opdater(prev => harTopFelt
    ? prev.filter(f => !(f.side === 1 && f.x === 0 && f.y === 0 && f.w === 1))
    : [...prev, { side: 1, ...topFelt(), id: nyId() }]);

  const naeste = () => {
    if (index + 1 < koe.length) setIndex(index + 1);
    else onLuk();
  };

  const godkend = async () => {
    setGemmer(true);
    setFejl(null);
    try {
      const fil = await lavAnonymiseretPdf(data, felter, item.filnavn);
      await onGodkend(item, fil, { felter: felter.length });
      naeste();
    } catch (err) {
      setFejl(err.message);
    } finally {
      setGemmer(false);
    }
  };

  const ikkeAlleSider = data && data.totalSider > data.sider.length;

  return (
    <div className="fixed inset-0 z-50 bg-paper flex flex-col" role="dialog" aria-modal="true" aria-labelledby="anon-titel" ref={dialogRef} tabIndex={-1}
      onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); fortryd(); } }}>
      <header className="bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1 basis-72">
            <h2 id="anon-titel" className="font-semibold truncate">
              Anonymisér: {item.student ? `${item.student.studentNumber}. ${item.student.studentName}` : item.filnavn}
            </h2>
            <p className="text-[13px] text-ink-soft">
              {koe.length > 1 && <>Besvarelse {index + 1} af {koe.length} · </>}
              Træk sorte felter over alt, der kan afsløre eleven. Klik på et felt for at fjerne det.
            </p>
          </div>
          <button type="button" className="btn-ghost btn-sm" onClick={skiftTopFelt} disabled={!data}>
            {harTopFelt ? 'Fjern felt i toppen' : 'Dæk toppen af side 1'}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={fortryd} disabled={!historik.current.length}>Fortryd</button>
          <button type="button" className="btn-ghost btn-sm" onClick={koe.length > 1 ? naeste : onLuk} disabled={gemmer}>
            {koe.length > 1 ? 'Spring over' : 'Annuller'}
          </button>
          <button type="button" className="btn-primary" onClick={godkend} disabled={!data || gemmer}>
            {gemmer && <Loader2 />} Godkend og upload
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {fejl && <p className="field-error" role="alert">{fejl}</p>}
          {!data && !fejl && <p className="flex items-center gap-2 text-sm text-ink-soft"><Loader2 /> Læser besvarelsen…</p>}
          {data && (
            <>
              <p className="text-sm text-ink-soft">
                {felter.length === 0
                  ? 'Appen fandt ikke noget navn. Tjek siderne, og dæk navn, underskrift eller andet, der kan afsløre eleven.'
                  : `Appen har foreslået ${felter.length} ${felter.length === 1 ? 'felt' : 'felter'}. Tjek alle sider.`}
                {' '}Kun den dækkede version uploades – originalen bliver på din computer.
              </p>
              {ikkeAlleSider && (
                <p className="text-sm text-pen">Kun de første {data.sider.length} af {data.totalSider} sider kommer med.</p>
              )}
              {data.sider.map((s, i) => (
                <Side
                  key={s.nr}
                  side={s}
                  billede={data.billeder[i]}
                  felter={felter.filter(f => f.side === s.nr)}
                  onTilfoej={(r) => opdater(prev => [...prev, { side: s.nr, ...klip(r), id: nyId() }])}
                  onFjern={(id) => opdater(prev => prev.filter(f => f.id !== id))}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Én side med sorte felter. Træk med musen/fingeren for at tegne et felt. */
function Side({ side, billede, felter, onTilfoej, onFjern }) {
  const ref = useRef(null);
  const [kladde, setKladde] = useState(null);
  const start = useRef(null);

  const pos = (e) => {
    const r = ref.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const rekt = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  return (
    <figure className="relative">
      <figcaption className="text-[12px] text-ink-soft mb-1">Side {side.nr}</figcaption>
      <div
        ref={ref}
        className="relative select-none touch-none cursor-crosshair rounded-control overflow-hidden ring-1 ring-line bg-white"
        onPointerDown={(e) => {
          if (e.target.closest('[data-felt]')) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = pos(e);
          setKladde(rekt(start.current, start.current));
        }}
        onPointerMove={(e) => { if (start.current) setKladde(rekt(start.current, pos(e))); }}
        onPointerUp={(e) => {
          if (!start.current) return;
          const r = rekt(start.current, pos(e));
          start.current = null;
          setKladde(null);
          if (r.w > 0.01 && r.h > 0.005) onTilfoej(r);
        }}
      >
        <img src={billede} alt={`Side ${side.nr} af besvarelsen`} className="block w-full h-auto pointer-events-none" draggable={false} />
        {felter.map(f => (
          <button
            key={f.id}
            type="button"
            data-felt
            onClick={() => onFjern(f.id)}
            className="group absolute bg-black flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%` }}
            title="Klik for at fjerne feltet"
            aria-label={`Fjern sort felt på side ${side.nr}`}
          >
            <X className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        ))}
        {kladde && (
          <div className="absolute bg-black/70 ring-1 ring-black" style={{ left: `${kladde.x * 100}%`, top: `${kladde.y * 100}%`, width: `${kladde.w * 100}%`, height: `${kladde.h * 100}%` }} />
        )}
      </div>
    </figure>
  );
}

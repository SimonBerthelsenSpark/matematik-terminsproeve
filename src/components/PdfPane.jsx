/**
 * Viser elevens PDF-besvarelse side for side, så læreren kan rette med besvarelsen ved siden af.
 * Siderne tegnes med pdf.js (virker ens i alle browsere, også hvor PDF'er ikke kan vises i en iframe).
 * Når `page` ændres, rulles der til den side, og den markeres.
 */
import React, { useEffect, useRef, useState } from 'react';
import { loadPdfjs } from '../utils/docLibs.js';
import { Loader2, ExternalLink } from './Icons.jsx';

const MAX_SIDER = 40;

export function PdfPane({ file, loadFile, page = null, onOpenExternal, className = '' }) {
  const scrollRef = useRef(null);
  const pagesRef = useRef(null);
  const [state, setState] = useState({ status: 'loading', numPages: 0, error: null });

  // Tegn siderne
  useEffect(() => {
    let cancelled = false;
    let pdfDoc = null;
    const run = async () => {
      setState({ status: 'loading', numPages: 0, error: null });
      try {
        const blob = file || (loadFile ? await loadFile() : null);
        if (!blob) throw new Error('Besvarelsen blev ikke fundet');
        const pdfjs = await loadPdfjs();
        pdfDoc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (cancelled) return;
        const numPages = Math.min(pdfDoc.numPages, MAX_SIDER);
        setState({ status: 'rendering', numPages, error: null });

        const container = pagesRef.current;
        if (!container) return;
        container.innerHTML = '';
        const width = Math.max(320, (scrollRef.current?.clientWidth || 600) - 24);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        for (let n = 1; n <= numPages; n++) {
          if (cancelled) return;
          const p = await pdfDoc.getPage(n);
          const base = p.getViewport({ scale: 1 });
          const viewport = p.getViewport({ scale: (width / base.width) * dpr });

          const wrap = document.createElement('figure');
          wrap.dataset.page = String(n);
          wrap.className = 'pdf-page relative rounded-control bg-white shadow-sm ring-1 ring-line transition-shadow';
          const label = document.createElement('figcaption');
          label.textContent = `Side ${n}`;
          label.className = 'absolute top-2 left-2 text-[11.5px] font-semibold px-1.5 h-5 inline-flex items-center rounded-full bg-paper/90 text-ink-soft';
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.className = 'block rounded-control';
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `Besvarelsen, side ${n}`);
          wrap.append(canvas, label);
          container.append(wrap);
          await p.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        }
        if (!cancelled) setState({ status: 'done', numPages, error: null, total: pdfDoc.numPages });
      } catch (err) {
        if (!cancelled) setState({ status: 'error', numPages: 0, error: err.message });
      }
    };
    run();
    return () => {
      cancelled = true;
      pdfDoc?.destroy?.();
    };
  }, [file, loadFile]);

  // Rul til den valgte side
  useEffect(() => {
    const container = pagesRef.current;
    const scroller = scrollRef.current;
    if (!container || !scroller) return;
    container.querySelectorAll('.pdf-page').forEach(el => {
      const on = page && el.dataset.page === String(page);
      el.classList.toggle('ring-2', Boolean(on));
      el.classList.toggle('ring-focus', Boolean(on));
      el.classList.toggle('ring-1', !on);
      el.classList.toggle('ring-line', !on);
    });
    if (!page) return;
    const target = container.querySelector(`.pdf-page[data-page="${page}"]`);
    if (target) {
      scroller.scrollTo({
        top: target.offsetTop - container.offsetTop,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      });
    }
  }, [page, state.numPages, state.status]);

  return (
    <div className={`surface flex flex-col min-h-0 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 h-11 border-b border-line shrink-0">
        <p className="text-sm font-semibold">
          Besvarelsen
          {state.numPages > 0 && <span className="ml-1.5 font-normal text-ink-soft">{state.numPages} {state.numPages === 1 ? 'side' : 'sider'}</span>}
        </p>
        {onOpenExternal && (
          <button type="button" onClick={onOpenExternal} className="text-[13px] text-ink-soft hover:text-ink inline-flex items-center gap-1">
            Åbn i ny fane <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto bg-paper p-3">
        {(state.status === 'loading') && (
          <p className="flex items-center gap-2 text-sm text-ink-soft p-2"><Loader2 /> Henter besvarelsen…</p>
        )}
        {state.status === 'error' && (
          <p className="text-sm text-pen p-2">Besvarelsen kan ikke vises: {state.error}</p>
        )}
        <div ref={pagesRef} className="space-y-3" />
        {state.status === 'done' && state.total > state.numPages && (
          <p className="text-[13px] text-ink-soft mt-3">Kun de første {state.numPages} af {state.total} sider vises. Åbn i ny fane for resten.</p>
        )}
      </div>
    </div>
  );
}

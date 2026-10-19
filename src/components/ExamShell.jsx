import React from 'react';
import { Link } from 'react-router-dom';
import { Layout } from './Layout.jsx';
import { ArrowLeft, Check } from './Icons.jsx';
import { formatDato } from './ui.jsx';
import { examStatus } from '../utils/examStatus.js';

/**
 * Ramme for en prøve: titel + de tre trin i arbejdsgangen.
 * Trinene er en rigtig rækkefølge (materiale → besvarelser → retning), derfor nummereret.
 */
export function ExamShell({ exam, step, actions, children }) {
  const status = exam ? examStatus(exam) : null;
  const base = `/exams/${exam?.id}`;

  const steps = [
    {
      key: 'materiale',
      label: 'Materiale',
      to: `${base}/edit`,
      done: status?.materialeOk,
      detail: status?.materialeOk ? 'Klar' : 'Mangler'
    },
    {
      key: 'besvarelser',
      label: 'Besvarelser',
      to: `${base}/matrix`,
      done: (status?.uploaded || 0) > 0,
      detail: `${status?.uploaded || 0} uploadet`
    },
    {
      key: 'retning',
      label: 'Retning',
      to: base,
      done: status && status.graded > 0 && status.reviewed >= status.graded && status.graded >= status.uploaded,
      detail: status?.graded ? `${status.reviewed} af ${status.graded} godkendt` : 'Ikke startet'
    }
  ];

  return (
    <Layout>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-4">
        <ArrowLeft className="w-4 h-4" /> Alle prøver
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-semibold">{exam?.beskrivelse || 'Prøve'}</h1>
          {exam && (
            <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
              <div><dt className="sr-only">Fag</dt><dd>{exam.type}</dd></div>
              <div><dt className="sr-only">Klasse</dt><dd>Klasse {exam.klasse || '–'}</dd></div>
              <div><dt className="sr-only">Dato</dt><dd>{formatDato(exam.dato)}</dd></div>
            </dl>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </div>

      <nav aria-label="Trin" className="mt-6 mb-6">
        <ol className="grid grid-cols-3 gap-2 sm:gap-3">
          {steps.map((s, i) => {
            const active = s.key === step;
            return (
              <li key={s.key}>
                <Link
                  to={s.to}
                  aria-current={active ? 'step' : undefined}
                  className={`group flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 rounded-surface border px-2 sm:px-4 py-2.5 sm:py-3 text-center sm:text-left transition-colors ${
                    active ? 'bg-surface border-ink shadow-[inset_0_-2px_0_0_#1E2B3A]' : 'bg-surface/60 border-line hover:bg-surface hover:border-line-strong'
                  }`}
                >
                  <span
                    className={`num inline-flex items-center justify-center w-7 h-7 rounded-full text-[13px] font-semibold shrink-0 ${
                      s.done ? 'bg-ok text-white' : active ? 'bg-ink text-white' : 'bg-paper text-ink-soft border border-line-strong'
                    }`}
                  >
                    {s.done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] sm:text-sm font-semibold text-ink">{s.label}</span>
                    <span className="hidden sm:block text-[13px] text-ink-soft truncate">{s.detail}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      {children}
    </Layout>
  );
}

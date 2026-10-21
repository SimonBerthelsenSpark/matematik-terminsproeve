import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useActiveRuns } from '../services/gradingRuns.js';
import { Loader2 } from './Icons.jsx';

/**
 * Fælles ramme: smal topbar med navn og navigation.
 */
export function Layout({ children, width = 'wide' }) {
  const max = width === 'narrow' ? 'max-w-3xl' : 'max-w-6xl';
  const navClass = ({ isActive }) =>
    `h-14 inline-flex items-center px-1 text-sm font-medium border-b-2 transition-colors ${
      isActive ? 'border-ink text-ink' : 'border-transparent text-ink-soft hover:text-ink'
    }`;

  return (
    <div className="min-h-screen bg-paper">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 btn-secondary">Gå til indhold</a>
      <header className="bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-5 sm:gap-8">
          <Link to="/" className="flex items-center gap-2.5 h-14 shrink-0" aria-label="AI Prøveretter – forside">
            <Logo />
            <span className="hidden sm:inline font-semibold text-[16px] tracking-[-0.01em]">AI Prøveretter</span>
          </Link>
          <nav className="flex gap-4 sm:gap-6" aria-label="Hovedmenu">
            <NavLink to="/" end className={navClass}>Prøver</NavLink>
            <NavLink to="/klasser" className={navClass}>Klasser</NavLink>
            <NavLink to="/forbrug" className={navClass}>Forbrug</NavLink>
            <NavLink to="/indstillinger" className={navClass}>Indstillinger</NavLink>
          </nav>
        </div>
      </header>
      <RunningBar />
      <main id="main" className={`${max} mx-auto px-4 sm:px-6 py-8`}>
        {children}
      </main>
    </div>
  );
}

/**
 * Vises på alle andre sider, mens en retning kører, så læreren kan gå tilbage til den.
 */
function RunningBar() {
  const runs = useActiveRuns();
  const { pathname } = useLocation();
  const synlige = runs.filter(r => pathname.replace(/\/$/, '') !== `/exams/${r.examId}`);
  if (synlige.length === 0) return null;
  return (
    <div className="bg-ink text-white" role="status" aria-live="polite">
      {synlige.map(r => (
        <div key={r.examId} className="max-w-6xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-2 min-w-0">
            <Loader2 className="w-4 h-4 shrink-0" />
            <span className="truncate">Retter <span className="font-semibold">{r.title}</span></span>
            <span className="num text-white/70 shrink-0">{r.done} af {r.total}</span>
          </span>
          <Link to={`/exams/${r.examId}`} className="ml-auto underline underline-offset-2 hover:text-white/80 shrink-0">Gå til retningen</Link>
        </div>
      ))}
      <p className="sr-only">Retningen fortsætter, mens du bruger resten af appen. Luk ikke fanen.</p>
    </div>
  );
}

/** Lille mærke: et karakterfelt med et flueben – appens idé i ét symbol. */
function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="1" y="1" width="20" height="20" rx="5" fill="#1E2B3A" />
      <path d="M6.5 11.5l3 3 6-7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

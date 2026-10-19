import React from 'react';
import { NavLink, Link } from 'react-router-dom';

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 h-14 shrink-0" aria-label="AI Prøveretter – forside">
            <Logo />
            <span className="font-semibold text-[16px] tracking-[-0.01em]">AI Prøveretter</span>
          </Link>
          <nav className="flex gap-6" aria-label="Hovedmenu">
            <NavLink to="/" end className={navClass}>Prøver</NavLink>
            <NavLink to="/klasser" className={navClass}>Klasser</NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className={`${max} mx-auto px-4 sm:px-6 py-8`}>
        {children}
      </main>
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

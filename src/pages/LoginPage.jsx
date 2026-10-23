import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth.jsx';
import { logInd, opretKonto, nulstilAdgangskode, sendBekraeftelse, logUd, authFejl } from '../services/authService.js';
import { auth } from '../config/firebase.js';
import { Loader2 } from '../components/Icons.jsx';

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="1" y="1" width="20" height="20" rx="5" fill="#1E2B3A" />
      <path d="M6.5 11.5l3 3 6-7" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Ramme({ title, children, footer }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center gap-2.5 mb-6 w-fit" aria-label="AI Prøveretter – forside">
          <Logo />
          <span className="font-semibold text-[17px] tracking-[-0.01em]">AI Prøveretter</span>
        </Link>
        <div className="surface p-6">
          <h1 className="text-[20px] font-semibold leading-tight mb-4">{title}</h1>
          {children}
        </div>
        {footer && <div className="mt-4 text-sm text-ink-soft">{footer}</div>}
      </div>
    </div>
  );
}

/** Log ind, opret konto og glemt adgangskode. */
export function LoginPage({ startMode = 'login' }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState(startMode); // login | opret | glemt
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState(null);
  const [sendt, setSendt] = useState(false);

  const skift = (m) => {
    setMode(m);
    setFejl(null);
    setSendt(false);
    // Hold adressen i takt med formularen (på andre sider end /login og /opret beholdes adressen)
    if (m === 'opret') navigate('/opret', { replace: true });
    else if (m === 'login' && window.location.pathname === '/opret') navigate('/login', { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setFejl(null);
    setBusy(true);
    try {
      if (mode === 'login') await logInd(email, password);
      else if (mode === 'opret') await opretKonto(email, password);
      else { await nulstilAdgangskode(email); setSendt(true); }
    } catch (err) {
      setFejl(authFejl(err));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? 'Log ind' : mode === 'opret' ? 'Opret konto' : 'Glemt adgangskode';

  return (
    <Ramme
      title={title}
      footer={mode === 'login'
        ? <>Ny lærer? <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => skift('opret')}>Opret en konto</button></>
        : <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => skift('login')}>Tilbage til log ind</button>}
    >
      {mode === 'glemt' && sendt ? (
        <p className="text-sm text-ink-soft">Hvis der findes en konto med <span className="font-medium text-ink">{email}</span>, har vi sendt et link til at vælge en ny adgangskode.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {mode === 'opret' && (
            <p className="text-sm text-ink-soft -mt-1">Brug din skole-mail. En administrator skal godkende kontoen, før du kan bruge appen.</p>
          )}
          <div>
            <label htmlFor="email" className="field-label">E-mail</label>
            <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          {mode !== 'glemt' && (
            <div>
              <label htmlFor="password" className="field-label">Adgangskode</label>
              <input
                id="password"
                type="password"
                autoComplete={mode === 'opret' ? 'new-password' : 'current-password'}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={mode === 'opret' ? 8 : undefined}
                required
              />
              {mode === 'opret' && <p className="field-hint">Mindst 8 tegn.</p>}
            </div>
          )}
          {fejl && <p className="field-error" role="alert">{fejl}</p>}
          <button type="submit" className="btn-primary w-full" disabled={busy || !email || (mode !== 'glemt' && !password)}>
            {busy && <Loader2 />}
            {mode === 'login' ? 'Log ind' : mode === 'opret' ? 'Opret konto' : 'Send link'}
          </button>
          {mode === 'login' && (
            <button type="button" className="text-sm text-ink-soft hover:text-ink underline underline-offset-2" onClick={() => skift('glemt')}>Glemt adgangskode?</button>
          )}
        </form>
      )}
    </Ramme>
  );
}

/** Kontoen er oprettet, men e-mailen er ikke bekræftet. */
export function BekraeftEmailPage() {
  const { user, opdater } = useAuth();
  const [busy, setBusy] = useState(false);
  const tjek = async () => {
    setBusy(true);
    try {
      await opdater();
      if (!auth.currentUser?.emailVerified) toast('E-mailen er ikke bekræftet endnu. Tjek også spam.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Ramme title="Bekræft din e-mail" footer={<button type="button" className="underline underline-offset-2 hover:text-ink" onClick={logUd}>Log ud</button>}>
      <p className="text-sm text-ink-soft">Vi har sendt et link til <span className="font-medium text-ink">{user?.email}</span>. Klik på linket, og kom tilbage hertil.</p>
      <div className="mt-5 flex flex-col gap-2">
        <button type="button" className="btn-primary w-full" onClick={tjek} disabled={busy}>{busy && <Loader2 />} Jeg har bekræftet</button>
        <button
          type="button"
          className="btn-ghost w-full"
          onClick={async () => {
            try { await sendBekraeftelse(); toast.success('Ny e-mail er sendt'); } catch (err) { toast.error(authFejl(err)); }
          }}
        >
          Send e-mailen igen
        </button>
      </div>
    </Ramme>
  );
}

/** E-mailen er bekræftet, men kontoen er ikke godkendt af en administrator. */
export function AfventerGodkendelsePage() {
  const { user, opdater } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Ramme title="Venter på godkendelse" footer={<button type="button" className="underline underline-offset-2 hover:text-ink" onClick={logUd}>Log ud</button>}>
      <p className="text-sm text-ink-soft">
        Din konto <span className="font-medium text-ink">{user?.email}</span> er oprettet. En administrator skal godkende den, før du kan bruge appen.
        Elevernes besvarelser er persondata, så kun godkendte lærere får adgang.
      </p>
      <div className="mt-5">
        <button type="button" className="btn-secondary w-full" disabled={busy} onClick={async () => { setBusy(true); try { await opdater(); } finally { setBusy(false); } }}>
          {busy && <Loader2 />} Tjek igen
        </button>
      </div>
    </Ramme>
  );
}

/** Vises mens login-tilstanden hentes. */
export function AuthLoader() {
  return <div className="min-h-screen bg-paper" aria-busy="true" />;
}


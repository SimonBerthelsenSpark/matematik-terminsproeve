import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Layout } from '../components/Layout.jsx';
import { PageHeader, Notice, useConfirm } from '../components/ui.jsx';
import { Loader2, Trash2 } from '../components/Icons.jsx';
import { deleteAllData } from '../services/dataReset.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { hentBrugere, godkendBruger, fjernBruger, logUd, authFejl } from '../services/authService.js';
import { findDataUdenEjer, overtagData } from '../services/migration.js';
import { ADMIN_EMAILS } from '../config/admins.js';

/** Administratorer godkender lærere. Kun godkendte e-mails kan bruge appen. */
function Laerere() {
  const confirm = useConfirm();
  const { user } = useAuth();
  const [liste, setListe] = useState(null);
  const [email, setEmail] = useState('');
  const [rolle, setRolle] = useState('laerer');
  const [busy, setBusy] = useState(false);
  const [fejl, setFejl] = useState(null);

  const hent = () => hentBrugere().then(setListe).catch(err => setFejl(err.message));
  useEffect(() => { hent(); }, []);

  const tilfoej = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFejl(null);
    try {
      await godkendBruger(email, rolle);
      toast.success(`${email.trim()} er godkendt`);
      setEmail('');
      setRolle('laerer');
      await hent();
    } catch (err) {
      setFejl(authFejl(err));
    } finally {
      setBusy(false);
    }
  };

  const fjern = async (b) => {
    const ok = await confirm({
      title: 'Fjern adgang?',
      message: `${b.email} kan ikke længere logge ind i appen. Lærerens prøver bliver liggende.`,
      confirmLabel: 'Fjern adgang',
      danger: true
    });
    if (!ok) return;
    try {
      await fjernBruger(b.email);
      await hent();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section className="surface" aria-labelledby="laerere-titel">
      <div className="p-5 border-b border-line">
        <h2 id="laerere-titel" className="text-[17px] font-semibold">Lærere</h2>
        <p className="mt-1 text-sm text-ink-soft max-w-prose">
          Kun godkendte e-mails kan bruge appen. Læreren opretter selv sin konto med samme e-mail. Hver lærer ser kun sine egne prøver og klasser.
        </p>
      </div>
      <ul className="divide-y divide-line">
        {ADMIN_EMAILS.map(a => (
          <li key={a} className="px-5 py-3 flex items-center gap-3 text-sm">
            <span className="min-w-0 truncate">{a}</span>
            <span className="text-[12px] text-ink-soft">Administrator (fast)</span>
          </li>
        ))}
        {liste === null && !fejl && <li className="px-5 py-3 text-sm text-ink-soft">Henter…</li>}
        {(liste || []).filter(b => !ADMIN_EMAILS.includes(b.email)).map(b => (
          <li key={b.email} className="px-5 py-3 flex items-center gap-3 text-sm">
            <span className="min-w-0 truncate">{b.email}</span>
            <span className="text-[12px] text-ink-soft">{b.rolle === 'admin' ? 'Administrator' : 'Lærer'}</span>
            {b.email !== user?.email?.toLowerCase() && (
              <button type="button" className="ml-auto btn-ghost btn-sm text-pen hover:text-pen" onClick={() => fjern(b)}>Fjern</button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={tilfoej} className="p-5 border-t border-line flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label htmlFor="ny-laerer" className="field-label">Godkend e-mail</label>
          <input id="ny-laerer" type="email" className="input" placeholder="laerer@skole.dk" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ny-rolle" className="field-label">Rolle</label>
          <select id="ny-rolle" className="input" value={rolle} onChange={(e) => setRolle(e.target.value)}>
            <option value="laerer">Lærer</option>
            <option value="admin">Administrator</option>
          </select>
        </div>
        <button type="submit" className="btn-primary" disabled={busy || !email.trim()}>{busy && <Loader2 />} Godkend</button>
      </form>
      {fejl && <p className="px-5 pb-4 field-error">{fejl}</p>}
    </section>
  );
}

/** Data fra før login skal have en ejer, ellers kan ingen se dem, når databasen låses. */
function DataUdenEjer() {
  const [fundet, setFundet] = useState(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => { findDataUdenEjer().then(setFundet).catch(() => setFundet(null)); }, []);
  const antal = fundet ? fundet.exams.length + fundet.classes.length + fundet.usageDaily.length : 0;
  if (!fundet || antal === 0) return null;

  const overtag = async () => {
    setBusy(true);
    try {
      const n = await overtagData(fundet);
      toast.success(`${n} poster er nu dine`);
      setFundet(await findDataUdenEjer());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Notice
      tone="info"
      title="Data fra før login"
      action={<button type="button" className="btn-primary btn-sm self-center" onClick={overtag} disabled={busy}>{busy && <Loader2 />} Overtag</button>}
    >
      Der er {fundet.exams.length} prøver, {fundet.classes.length} klasser og {fundet.usageDaily.length} dages forbrug uden ejer.
      Overtag dem, før databasen låses, ellers kan ingen se dem bagefter.
    </Notice>
  );
}

const BEKRAEFT = 'SLET ALT';

/**
 * Indstillinger: konto, lærere (administratorer) og "Slet alle mine data".
 */
export function SettingsPage() {
  const { user, erAdmin } = useAuth();
  const [text, setText] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const ready = text.trim() === BEKRAEFT && !running;

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await deleteAllData(setProgress);
      setResult(r);
      setText('');
      toast.success('Alle dine data er slettet');
    } catch (err) {
      setError(err.message);
      toast.error(`Sletningen stoppede: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Layout width="narrow">
      <PageHeader title="Indstillinger" />

      <div className="space-y-6">
      <section className="surface p-5 flex flex-wrap items-center gap-3" aria-label="Konto">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-soft">Logget ind som</p>
          <p className="font-medium truncate">{user?.email}{erAdmin && <span className="ml-2 text-[12px] font-normal text-ink-soft">Administrator</span>}</p>
        </div>
        <button type="button" className="btn-secondary ml-auto" onClick={logUd}>Log ud</button>
      </section>

      <section className="surface p-5 flex flex-wrap items-center gap-3" aria-label="Databehandling">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Databehandling</p>
          <p className="text-sm text-ink-soft">Hvilke elevdata appen behandler, hvor de ligger, og hvor længe.</p>
        </div>
        <Link to="/databehandling" className="btn-secondary">Læs mere</Link>
      </section>

      {erAdmin && <DataUdenEjer />}
      {erAdmin && <Laerere />}

      <section className="surface border-[#F1CFCA]" aria-labelledby="slet-alt-titel">
        <div className="p-5">
          <h2 id="slet-alt-titel" className="text-[17px] font-semibold text-pen">Slet alle mine data</h2>
          <p className="mt-1 text-sm text-ink-soft max-w-prose">
            Sletter permanent alle dine prøver, rettelser og karakterer, alle elevbesvarelser og uploadede filer,
            dine klasser og elever samt dit forbrug. Andre læreres data røres ikke. Det kan ikke fortrydes.
          </p>

          <form onSubmit={handleDelete} className="mt-5 space-y-3">
            <div>
              <label htmlFor="bekraeft" className="field-label">
                Skriv <span className="font-mono px-1 rounded bg-paper">{BEKRAEFT}</span> for at bekræfte
              </label>
              <input
                id="bekraeft"
                className="input max-w-xs"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoComplete="off"
                disabled={running}
              />
            </div>
            <button type="submit" className="btn-danger" disabled={!ready}>
              {running ? <Loader2 /> : <Trash2 className="w-4 h-4" />}
              {running ? 'Sletter…' : 'Slet alle mine data'}
            </button>
          </form>

          {running && progress && (
            <p className="mt-4 text-sm text-ink-soft" role="status">
              {progress.phase} <span className="num">{progress.documents}</span> poster og <span className="num">{progress.files}</span> filer slettet.
            </p>
          )}

          {result && (
            <div className="mt-4">
              <Notice tone="ok" title="Alle dine data er slettet">
                <span className="num">{result.documents}</span> poster og <span className="num">{result.files}</span> filer er fjernet.
                {result.storageError && <> Filerne kunne dog ikke listes ({result.storageError}). Slet dem i Firebase-konsollen under Storage.</>}
              </Notice>
            </div>
          )}

          {error && (
            <div className="mt-4">
              <Notice title="Sletningen stoppede">
                {error}. Noget kan allerede være slettet. Prøv igen for at slette resten.
              </Notice>
            </div>
          )}
        </div>
      </section>
      </div>
    </Layout>
  );
}

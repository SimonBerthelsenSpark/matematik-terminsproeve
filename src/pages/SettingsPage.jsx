import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Layout } from '../components/Layout.jsx';
import { PageHeader, Notice } from '../components/ui.jsx';
import { Loader2, Trash2 } from '../components/Icons.jsx';
import { deleteAllData } from '../services/dataReset.js';

const BEKRAEFT = 'SLET ALT';

/**
 * Indstillinger: indtil videre kun "Slet alle data".
 */
export function SettingsPage() {
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
      toast.success('Alle data er slettet');
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

      <section className="surface border-[#F1CFCA]" aria-labelledby="slet-alt-titel">
        <div className="p-5">
          <h2 id="slet-alt-titel" className="text-[17px] font-semibold text-pen">Slet alle data</h2>
          <p className="mt-1 text-sm text-ink-soft max-w-prose">
            Sletter alt permanent: alle prøver, rettelser og karakterer, alle elevbesvarelser og uploadede filer,
            samt alle klasser og elever. Det kan ikke fortrydes.
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
              {running ? 'Sletter…' : 'Slet alle data'}
            </button>
          </form>

          {running && progress && (
            <p className="mt-4 text-sm text-ink-soft" role="status">
              {progress.phase} <span className="num">{progress.documents}</span> poster og <span className="num">{progress.files}</span> filer slettet.
            </p>
          )}

          {result && (
            <div className="mt-4">
              <Notice tone="ok" title="Alle data er slettet">
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
    </Layout>
  );
}

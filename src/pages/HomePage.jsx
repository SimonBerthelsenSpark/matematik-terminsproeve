import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { useExams } from '../hooks/useExams.js';
import { Layout } from '../components/Layout.jsx';
import { Plus, Trash2, Loader2 } from '../components/Icons.jsx';
import { PageHeader, Spinner, Notice, EmptyState, StatusPill, formatDato, useConfirm } from '../components/ui.jsx';
import { permanentlyDeleteExam, getSubmissions } from '../services/firestoreService.js';
import { examStatus } from '../utils/examStatus.js';

/**
 * Forside: alle prøver med fremdrift og næste skridt.
 */
export function HomePage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { exams, loading, error, refreshExams } = useExams();
  const [deleting, setDeleting] = useState(null);

  const handleDeleteExam = async (exam) => {
    setDeleting(exam.id);
    try {
      const submissions = await getSubmissions(exam.id);
      if (submissions.length > 0) {
        toast.error(
          `"${exam.beskrivelse}" har ${submissions.length} ${submissions.length === 1 ? 'besvarelse' : 'besvarelser'}.\nSlet dem under Besvarelser, før du sletter prøven.`
        );
        return;
      }

      const ok = await confirm({
        title: 'Slet prøven?',
        message: `"${exam.beskrivelse}" og alle dens filer og rettelser slettes permanent.`,
        confirmLabel: 'Slet prøve',
        danger: true
      });
      if (!ok) return;

      await permanentlyDeleteExam(exam.id);
      await refreshExams();
      toast.success('Prøven er slettet');
    } catch (err) {
      toast.error(`Prøven kunne ikke slettes: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Prøver"
        description="Følg hver prøve fra materiale til godkendte karakterer."
        actions={
          <Link to="/exams/new" className="btn-primary">
            <Plus className="w-4 h-4" /> Ny prøve
          </Link>
        }
      />

      {loading && <Spinner label="Indlæser prøver…" />}

      {error && !loading && (
        <Notice title="Prøverne kunne ikke indlæses">{error}. Genindlæs siden for at prøve igen.</Notice>
      )}

      {!loading && !error && exams.length === 0 && (
        <div className="surface">
          <EmptyState
            title="Ingen prøver endnu"
            action={<Link to="/exams/new" className="btn-primary"><Plus className="w-4 h-4" /> Opret din første prøve</Link>}
          >
            En prøve samler rettevejledning, elevernes besvarelser og karaktererne ét sted.
            Har du ikke oprettet klassen endnu, så start under <Link to="/klasser" className="underline underline-offset-2">Klasser</Link>.
          </EmptyState>
        </div>
      )}

      {!loading && !error && exams.length > 0 && (
        <div className="surface overflow-hidden">
          {/* Kolonneoverskrifter (kun bred skærm) */}
          <div className="hidden md:grid grid-cols-[minmax(0,2.4fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,1.5fr)_2.5rem] gap-4 px-5 py-2.5 border-b border-line bg-paper/60 text-[13px] font-semibold text-ink-soft">
            <span>Prøve</span>
            <span>Klasse</span>
            <span>Dato</span>
            <span>Fremdrift</span>
            <span>Næste skridt</span>
            <span className="sr-only">Handlinger</span>
          </div>
          <ul>
            {exams.map((exam) => (
              <ExamRow
                key={exam.id}
                exam={exam}
                onOpen={(to) => navigate(to)}
                onDelete={() => handleDeleteExam(exam)}
                isDeleting={deleting === exam.id}
              />
            ))}
          </ul>
        </div>
      )}
    </Layout>
  );
}

function ExamRow({ exam, onOpen, onDelete, isDeleting }) {
  const status = examStatus(exam);
  const { next } = status;

  return (
    <li className="group relative border-b border-line last:border-b-0 hover:bg-paper/50 transition-colors">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2.4fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,1.5fr)_2.5rem] gap-x-4 gap-y-2 items-center px-5 py-4">
        {/* Titel – hele rækken er klikbar via dette link */}
        <div className="min-w-0">
          <Link
            to={next.to}
            className="font-semibold text-ink hover:underline underline-offset-2 after:absolute after:inset-0 after:content-['']"
            onClick={(e) => { e.preventDefault(); onOpen(next.to); }}
          >
            {exam.beskrivelse || 'Uden titel'}
          </Link>
          <p className="text-[13px] text-ink-soft flex flex-wrap gap-x-3">
            <span>{exam.type}</span>
            <span className="md:hidden">Klasse {exam.klasse || '–'}</span>
            <span className="md:hidden">{formatDato(exam.dato)}</span>
          </p>
        </div>

        <span className="hidden md:block text-sm">{exam.klasse || '–'}</span>
        <span className="hidden md:block text-sm text-ink-soft">{formatDato(exam.dato)}</span>

        <div className="hidden md:block">
          <Progress uploaded={status.uploaded} graded={status.graded} reviewed={status.reviewed} />
        </div>

        <div className="col-span-1 md:col-span-1 order-last md:order-none">
          <StatusPill tone={next.tone === 'ok' ? 'ok' : 'neutral'}>
            {next.tone === 'attention' && <span className="w-1.5 h-1.5 rounded-full bg-pen" aria-hidden="true" />}
            {next.label}
          </StatusPill>
        </div>

        <div className="relative z-10 flex justify-end row-start-1 col-start-2 md:row-auto md:col-auto">
          <button
            type="button"
            className="btn-icon opacity-100 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label={`Slet ${exam.beskrivelse}`}
            title="Slet prøve"
          >
            {isDeleting ? <Loader2 /> : <Trash2 />}
          </button>
        </div>
      </div>
    </li>
  );
}

/** Kompakt fremdrift: rettet og godkendt ud af uploadede besvarelser. */
function Progress({ uploaded, graded, reviewed }) {
  if (!uploaded) return <span className="text-sm text-ink-faint">Ingen besvarelser</span>;
  const pct = (n) => `${Math.min(100, Math.round((n / uploaded) * 100))}%`;
  return (
    <div className="max-w-[11rem]">
      <div className="relative h-1.5 rounded-full bg-line overflow-hidden" aria-hidden="true">
        <div className="absolute inset-y-0 left-0 bg-ink-faint" style={{ width: pct(graded) }} />
        <div className="absolute inset-y-0 left-0 bg-ok" style={{ width: pct(reviewed) }} />
      </div>
      <p className="num mt-1.5 text-[13px] text-ink-soft">
        {graded} af {uploaded} rettet{reviewed > 0 ? `, ${reviewed} godkendt` : ''}
      </p>
    </div>
  );
}

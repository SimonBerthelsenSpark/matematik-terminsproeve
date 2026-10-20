import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useNavigate } from 'react-router-dom';
import { useExams } from '../hooks/useExams.js';
import { useClasses } from '../hooks/useClasses.js';
import { Layout } from '../components/Layout.jsx';
import { ArrowLeft, Loader2 } from '../components/Icons.jsx';
import { FileField, Notice } from '../components/ui.jsx';
import { uploadExamFile } from '../services/storageService.js';
import { updateExamFileRef } from '../services/firestoreService.js';

const FAG = ['Matematik', 'Dansk'];
const ANDEN_KLASSE = '__anden__';

/**
 * Opret prøve. Materialet kan tilføjes nu eller senere.
 */
export function CreateExamPage() {
  const navigate = useNavigate();
  const { createExam } = useExams();
  const { classes, loading: loadingClasses } = useClasses();

  const [formData, setFormData] = useState({ beskrivelse: '', dato: '', klasse: '', type: 'Matematik' });
  const [customClassName, setCustomClassName] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [files, setFiles] = useState({ rettevejledning: null, omsætningstabel: null, bedoemmelseskema: null });

  const useCustomClass = formData.klasse === ANDEN_KLASSE || (!loadingClasses && classes.length === 0);

  const set = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validate = () => {
    const e = {};
    if (!formData.beskrivelse.trim()) e.beskrivelse = 'Giv prøven en titel';
    if (!formData.dato) e.dato = 'Vælg prøvens dato';
    const klasse = useCustomClass ? customClassName : formData.klasse;
    if (!klasse || !klasse.trim()) e.klasse = 'Vælg klassen';
    setErrors(e);
    // Flyt fokus til første felt med fejl
    const first = ['beskrivelse', 'klasse', 'dato'].find(k => e[k]);
    if (first) document.getElementById(first === 'klasse' && useCustomClass && classes.length > 0 ? 'klasse-custom' : first)?.focus();
    return Object.keys(e).length === 0;
  };

  const uploadOne = async (examId, fileType, refField) => {
    const file = files[fileType];
    if (!file) return true;
    try {
      const result = await uploadExamFile(examId, file, fileType);
      await updateExamFileRef(examId, refField, result);
      return true;
    } catch (err) {
      toast.error(`${file.name} kunne ikke uploades: ${err.message}`);
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    try {
      setSubmitting(true);
      const klasse = useCustomClass ? customClassName.trim() : formData.klasse;
      const examId = await createExam({ ...formData, klasse, dato: new Date(formData.dato) });

      if (formData.type === 'Matematik') {
        await uploadOne(examId, 'rettevejledning', 'rettevejledningRef');
        await uploadOne(examId, 'omsætningstabel', 'omsætningstabelRef');
      } else {
        await uploadOne(examId, 'bedoemmelseskema', 'bedoemmelseskemaRef');
      }

      toast.success('Prøven er oprettet');
      // Fortsæt på prøvens første trin, hvor materialet kan tjekkes
      navigate(`/exams/${examId}/edit`);
    } catch (err) {
      setSubmitError(err.message || 'Prøven kunne ikke oprettes');
      setSubmitting(false);
    }
  };

  return (
    <Layout width="narrow">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-4">
        <ArrowLeft className="w-4 h-4" /> Alle prøver
      </Link>
      <h1 className="text-[26px] leading-tight font-semibold">Ny prøve</h1>
      <p className="mt-1 text-ink-soft mb-6">Du kan tilføje materialet nu eller senere.</p>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <section className="surface p-5 space-y-5">
          <div>
            <label htmlFor="beskrivelse" className="field-label">Titel</label>
            <input
              id="beskrivelse"
              className={`input ${errors.beskrivelse ? 'input-invalid' : ''}`}
              value={formData.beskrivelse}
              onChange={(e) => set('beskrivelse', e.target.value)}
              placeholder="Fx FP9 Matematik maj 2026"
              aria-invalid={Boolean(errors.beskrivelse)}
              aria-describedby={errors.beskrivelse ? 'beskrivelse-error' : undefined}
            />
            {errors.beskrivelse && <p id="beskrivelse-error" className="field-error">{errors.beskrivelse}</p>}
          </div>

          <fieldset>
            <legend className="field-label">Fag</legend>
            <div className="inline-flex p-1 rounded-control bg-paper border border-line" role="radiogroup">
              {FAG.map(fag => (
                <label key={fag} className={`cursor-pointer px-4 h-8 inline-flex items-center rounded-[5px] text-sm font-semibold transition-colors ${formData.type === fag ? 'bg-surface text-ink shadow-sm border border-line' : 'text-ink-soft hover:text-ink border border-transparent'}`}>
                  <input type="radio" name="type" value={fag} checked={formData.type === fag} onChange={() => set('type', fag)} className="sr-only" />
                  {fag}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="klasse" className="field-label">Klasse</label>
              {!loadingClasses && classes.length > 0 && (
                <select
                  id="klasse"
                  className={`input ${errors.klasse && !useCustomClass ? 'input-invalid' : ''}`}
                  value={formData.klasse}
                  onChange={(e) => set('klasse', e.target.value)}
                >
                  <option value="">Vælg klasse</option>
                  {classes.map(c => <option key={c.id} value={c.className}>{c.className} ({c.studentCount || 0} elever)</option>)}
                  <option value={ANDEN_KLASSE}>Anden klasse…</option>
                </select>
              )}
              {useCustomClass && (
                <input
                  id={classes.length > 0 ? 'klasse-custom' : 'klasse'}
                  className={`input ${classes.length > 0 ? 'mt-2' : ''} ${errors.klasse ? 'input-invalid' : ''}`}
                  value={customClassName}
                  onChange={(e) => { setCustomClassName(e.target.value); if (errors.klasse) setErrors(p => ({ ...p, klasse: null })); }}
                  placeholder="Klassens navn"
                  aria-label="Klassens navn"
                />
              )}
              {errors.klasse && <p className="field-error">{errors.klasse}</p>}
              {useCustomClass && (
                <p className="field-hint">Opret klassen under <Link to="/klasser" className="underline underline-offset-2">Klasser</Link> for at kunne uploade besvarelser pr. elev.</p>
              )}
            </div>
            <div>
              <label htmlFor="dato" className="field-label">Dato</label>
              <input
                id="dato"
                type="date"
                className={`input ${errors.dato ? 'input-invalid' : ''}`}
                value={formData.dato}
                onChange={(e) => set('dato', e.target.value)}
                aria-invalid={Boolean(errors.dato)}
              />
              {errors.dato && <p className="field-error">{errors.dato}</p>}
            </div>
          </div>

          {formData.type === 'Matematik' && (
            <p className="text-[13px] text-ink-soft">
              AI ser altid besvarelsernes sider som billeder, så tegninger, grafer og håndskrift kommer med. Hver besvarelse rettes to gange uafhængigt, og opgaver hvor de to retninger er uenige, markeres "Tjek".
            </p>
          )}
        </section>

        <section className="surface p-5 space-y-5">
          <div>
            <h2 className="text-[17px] font-semibold">Materiale</h2>
            <p className="text-sm text-ink-soft mt-0.5">Valgfrit nu. Uden materiale kan prøven ikke rettes.</p>
          </div>
          {formData.type === 'Matematik' ? (
            <>
              <FileField
                id="rettevejledning"
                label="Rettevejledning"
                hint="PDF eller Word"
                accept=".pdf,.docx,.txt"
                selected={files.rettevejledning}
                onSelect={(f) => setFiles(p => ({ ...p, rettevejledning: f }))}
              />
              <FileField
                id="omsaetningstabel"
                label="Omsætningstabel"
                hint="PDF eller Word. Du kan tjekke og rette tabellen bagefter."
                accept=".pdf,.docx,.txt"
                selected={files.omsætningstabel}
                onSelect={(f) => setFiles(p => ({ ...p, omsætningstabel: f }))}
              />
            </>
          ) : (
            <FileField
              id="bedoemmelseskema"
              label="Bedømmelseskema"
              hint="PDF eller Word med kriterier og vægte"
              accept=".pdf,.docx,.txt"
              selected={files.bedoemmelseskema}
              onSelect={(f) => setFiles(p => ({ ...p, bedoemmelseskema: f }))}
            />
          )}
        </section>

        {submitError && <Notice title="Prøven kunne ikke oprettes">{submitError}</Notice>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Link to="/" className="btn-ghost">Annuller</Link>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting && <Loader2 />} {submitting ? 'Opretter…' : 'Opret prøve'}
          </button>
        </div>
      </form>
    </Layout>
  );
}

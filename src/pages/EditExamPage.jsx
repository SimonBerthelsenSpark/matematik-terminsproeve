import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import { useExams } from '../hooks/useExams.js';
import { useClasses } from '../hooks/useClasses.js';
import { ExamShell } from '../components/ExamShell.jsx';
import { Layout } from '../components/Layout.jsx';
import { Loader2, RefreshCw } from '../components/Icons.jsx';
import { FileField, Section, Spinner, Notice } from '../components/ui.jsx';
import { uploadExamFile, getFileDownloadURL } from '../services/storageService.js';
import { updateExam, updateExamFileRef, generateVaegttabel, updateVaegttabel } from '../services/firestoreService.js';
import { parseDanskBedoemmelse, getCachedParsedBedoemmelse } from '../utils/danskBedoemmelsesParser.js';
import { OmsaetningstabelEditor } from '../components/OmsaetningstabelEditor.jsx';
import { totalVaegt, vaegteSummererTil100 } from '../utils/karakter.js';
import { harMateriale } from '../utils/examStatus.js';

const FILTYPER = {
  rettevejledning: { ref: 'rettevejledningRef', label: 'Rettevejledning', hint: 'PDF eller Word' },
  'omsætningstabel': { ref: 'omsætningstabelRef', label: 'Omsætningstabel', hint: 'PDF eller Word. Tallene læses ind i tabellen nedenfor.' },
  bedoemmelseskema: { ref: 'bedoemmelseskemaRef', label: 'Bedømmelseskema', hint: 'PDF eller Word med kriterier og vægte' }
};

/**
 * Trin 1: Materiale – filer, omsætningstabel/vægttabel og prøvens oplysninger.
 */
export function EditExamPage() {
  const { examId } = useParams();
  const { exams, loading: loadingExams, refreshExams } = useExams();
  const { classes } = useClasses();

  const [exam, setExam] = useState(null);
  const [formData, setFormData] = useState({ beskrivelse: '', dato: '', klasse: '', type: 'Matematik' });
  const [errors, setErrors] = useState({});
  const [savingInfo, setSavingInfo] = useState(false);

  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploading, setUploading] = useState(null);

  const [vaegttabel, setVaegttabel] = useState(null);
  const [vaegtDirty, setVaegtDirty] = useState(false);
  const [generatingVaegttabel, setGeneratingVaegttabel] = useState(false);
  const [savingVaegttabel, setSavingVaegttabel] = useState(false);

  // Hent prøven fra listen og fyld formularen første gang
  useEffect(() => {
    const current = exams.find(e => e.id === examId);
    if (!current) return;
    setExam(current);
    setFormData(prev => prev.beskrivelse ? prev : {
      beskrivelse: current.beskrivelse || '',
      dato: current.dato ? (current.dato.toDate ? current.dato.toDate() : new Date(current.dato)).toISOString().split('T')[0] : '',
      klasse: current.klasse || '',
      type: current.type || 'Matematik'
    });
    if (current.type === 'Dansk' && current.vaegttabel && !vaegtDirty) setVaegttabel(current.vaegttabel);
  }, [examId, exams]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!exam) {
    return (
      <Layout>
        {loadingExams || exams.length === 0 ? <Spinner label="Indlæser prøve…" /> : (
          <Notice title="Prøven findes ikke">Den kan være slettet. <Link to="/" className="underline">Gå til alle prøver</Link>.</Notice>
        )}
      </Layout>
    );
  }

  const isDansk = exam.type === 'Dansk';
  const fileTypes = isDansk ? ['bedoemmelseskema'] : ['rettevejledning', 'omsætningstabel'];

  // ---------- Filer ----------

  const openFile = async (ref) => {
    try {
      window.open(await getFileDownloadURL(ref.storagePath), '_blank', 'noopener');
    } catch (err) {
      toast.error(`Filen kunne ikke åbnes: ${err.message}`);
    }
  };

  const handleFileUpload = async (fileType) => {
    const file = selectedFiles[fileType];
    if (!file) return;
    const { ref: refField, label } = FILTYPER[fileType];
    try {
      setUploading(fileType);
      const uploadResult = await uploadExamFile(examId, file, fileType);
      await updateExamFileRef(examId, refField, uploadResult);
      setExam(prev => ({
        ...prev,
        [refField]: {
          fileName: uploadResult.metadata.fileName,
          storagePath: uploadResult.storagePath,
          uploadedAt: new Date(),
          fileSize: uploadResult.metadata.fileSize,
          contentType: uploadResult.metadata.contentType
        }
      }));
      setSelectedFiles(prev => ({ ...prev, [fileType]: null }));
      await refreshExams();
      toast.success(`${label} er uploadet`);
    } catch (err) {
      const msg = err.code === 'storage/unauthorized'
        ? 'Du har ikke adgang til at uploade. Tjek Firebase Storage-reglerne.'
        : err.message;
      toast.error(`${label} kunne ikke uploades: ${msg}`);
    } finally {
      setUploading(null);
    }
  };

  // ---------- Vægttabel (Dansk) ----------

  const handleGenerateVaegttabel = async () => {
    if (!exam.bedoemmelseskemaRef) {
      toast.error('Upload bedømmelseskemaet først');
      return;
    }
    try {
      setGeneratingVaegttabel(true);
      let parsed = vaegttabel ? null : getCachedParsedBedoemmelse(exam);
      if (!parsed?.dele?.length) {
        const url = await getFileDownloadURL(exam.bedoemmelseskemaRef.storagePath);
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], exam.bedoemmelseskemaRef.fileName, { type: exam.bedoemmelseskemaRef.contentType });
        parsed = await parseDanskBedoemmelse(file);
      }
      const ny = await generateVaegttabel(examId, parsed);
      setVaegttabel(ny);
      setVaegtDirty(false);
      await refreshExams();
      toast.success('Kriterierne er læst fra bedømmelseskemaet');
    } catch (error) {
      toast.error(`Kriterierne kunne ikke læses: ${error.message}`);
    } finally {
      setGeneratingVaegttabel(false);
    }
  };

  const handleWeightChange = (delIdx, kritIdx, newWeight) => {
    const vaegt = newWeight === '' ? 0 : parseFloat(newWeight);
    setVaegtDirty(true);
    setVaegttabel(prev => ({
      ...prev,
      dele: prev.dele.map((del, dIdx) => {
        if (dIdx !== delIdx) return del;
        const kriterier = del.kriterier.map((krit, kIdx) => (kIdx === kritIdx ? { ...krit, vaegt } : krit));
        const sum = kriterier.reduce((s, k) => s + (Number(k.vaegt) || 0), 0);
        return { ...del, kriterier, totalVaegt: Math.round(sum * 100) / 100 };
      })
    }));
  };

  const handleSaveVaegttabel = async () => {
    if (totalVaegt(vaegttabel) <= 0) {
      toast.error('Vægtene skal tilsammen være mere end 0 %');
      return;
    }
    try {
      setSavingVaegttabel(true);
      await updateVaegttabel(examId, vaegttabel);
      await refreshExams();
      setVaegtDirty(false);
      toast.success('Vægtene er gemt');
    } catch (error) {
      toast.error(`Vægtene kunne ikke gemmes: ${error.message}`);
    } finally {
      setSavingVaegttabel(false);
    }
  };

  // ---------- Oplysninger ----------

  const canChangeType = !(exam.stats?.totalSubmissions > 0);
  const klasseFindes = classes.some(c => c.className === formData.klasse);

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!formData.beskrivelse.trim()) errs.beskrivelse = 'Giv prøven en titel';
    if (!formData.dato) errs.dato = 'Vælg prøvens dato';
    if (!formData.klasse.trim()) errs.klasse = 'Vælg klassen';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      setSavingInfo(true);
      await updateExam(examId, {
        beskrivelse: formData.beskrivelse.trim(),
        klasse: formData.klasse.trim(),
        type: formData.type,
        dato: new Date(formData.dato)
      });
      await refreshExams();
      toast.success('Oplysningerne er gemt');
    } catch (err) {
      toast.error(`Oplysningerne kunne ikke gemmes: ${err.message}`);
    } finally {
      setSavingInfo(false);
    }
  };

  const klar = harMateriale(exam);

  return (
    <ExamShell
      exam={exam}
      step="materiale"
      actions={klar && <Link to={`/exams/${examId}/matrix`} className="btn-primary">Fortsæt til besvarelser</Link>}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <div className="space-y-6 min-w-0">
          <Section
            title={isDansk ? 'Bedømmelseskema' : 'Rettevejledning og omsætningstabel'}
            description={isDansk ? 'AI bedømmer hvert kriterium i skemaet på 7-trinsskalaen.' : 'AI giver point efter rettevejledningen. Karakteren beregnes ud fra omsætningstabellen.'}
          >
            <div className="space-y-5">
              {fileTypes.map(type => (
                <FileField
                  key={type}
                  id={`fil-${type}`}
                  label={FILTYPER[type].label}
                  hint={FILTYPER[type].hint}
                  accept=".pdf,.docx,.txt"
                  current={exam[FILTYPER[type].ref]}
                  selected={selectedFiles[type] || null}
                  onSelect={(f) => setSelectedFiles(prev => ({ ...prev, [type]: f }))}
                  onUpload={() => handleFileUpload(type)}
                  uploading={uploading === type}
                  onOpen={exam[FILTYPER[type].ref] ? () => openFile(exam[FILTYPER[type].ref]) : undefined}
                />
              ))}
            </div>
          </Section>

          {!isDansk && (
            <Section
              title="Omsætningstabel"
              description="Point → karakter. Tjek tallene, før du retter – karaktererne beregnes ud fra denne tabel."
            >
              <OmsaetningstabelEditor exam={exam} examId={examId} onSaved={refreshExams} />
            </Section>
          )}

          {isDansk && exam.bedoemmelseskemaRef && (
            <Section
              title="Kriterier og vægte"
              description="Vægtene bestemmer, hvor meget hvert kriterium tæller i den samlede karakter."
              actions={
                <button type="button" className="btn-secondary btn-sm" onClick={handleGenerateVaegttabel} disabled={generatingVaegttabel}>
                  {generatingVaegttabel ? <Loader2 /> : <RefreshCw className="w-4 h-4" />}
                  {vaegttabel ? 'Læs igen fra skemaet' : 'Læs kriterier fra skemaet'}
                </button>
              }
            >
              {!vaegttabel ? (
                <p className="text-sm text-ink-soft">Kriterierne er ikke læst endnu. Tryk "Læs kriterier fra skemaet".</p>
              ) : (
                <VaegtTabel
                  vaegttabel={vaegttabel}
                  onChange={handleWeightChange}
                  dirty={vaegtDirty}
                  saving={savingVaegttabel}
                  onSave={handleSaveVaegttabel}
                />
              )}
            </Section>
          )}
        </div>

        <Section title="Oplysninger" className="lg:sticky lg:top-6">
          <form onSubmit={handleSaveInfo} noValidate className="space-y-4">
            <div>
              <label htmlFor="beskrivelse" className="field-label">Titel</label>
              <input id="beskrivelse" className={`input ${errors.beskrivelse ? 'input-invalid' : ''}`} value={formData.beskrivelse} onChange={(e) => setFormData(p => ({ ...p, beskrivelse: e.target.value }))} />
              {errors.beskrivelse && <p className="field-error">{errors.beskrivelse}</p>}
            </div>
            <div>
              <label htmlFor="dato" className="field-label">Dato</label>
              <input id="dato" type="date" className={`input ${errors.dato ? 'input-invalid' : ''}`} value={formData.dato} onChange={(e) => setFormData(p => ({ ...p, dato: e.target.value }))} />
              {errors.dato && <p className="field-error">{errors.dato}</p>}
            </div>
            <div>
              <label htmlFor="klasse" className="field-label">Klasse</label>
              <select id="klasse" className={`input ${errors.klasse ? 'input-invalid' : ''}`} value={formData.klasse} onChange={(e) => setFormData(p => ({ ...p, klasse: e.target.value }))}>
                <option value="">Vælg klasse</option>
                {!klasseFindes && formData.klasse && <option value={formData.klasse}>{formData.klasse} (ikke oprettet)</option>}
                {classes.map(c => <option key={c.id} value={c.className}>{c.className}</option>)}
              </select>
              {errors.klasse && <p className="field-error">{errors.klasse}</p>}
            </div>
            <div>
              <label htmlFor="type" className="field-label">Fag</label>
              <select id="type" className="input" value={formData.type} onChange={(e) => setFormData(p => ({ ...p, type: e.target.value }))} disabled={!canChangeType}>
                <option>Matematik</option>
                <option>Dansk</option>
              </select>
              {!canChangeType && <p className="field-hint">Faget kan ikke ændres, når der er uploadet besvarelser.</p>}
            </div>
            <button type="submit" className="btn-secondary w-full" disabled={savingInfo}>
              {savingInfo && <Loader2 />} Gem oplysninger
            </button>
          </form>
        </Section>
      </div>
    </ExamShell>
  );
}

function VaegtTabel({ vaegttabel, onChange, dirty, saving, onSave }) {
  const sum = Math.round(totalVaegt(vaegttabel) * 100) / 100;
  const ok = vaegteSummererTil100(vaegttabel);

  return (
    <div>
      <div className="border border-line rounded-control overflow-hidden">
        <table className="table">
          <thead>
            <tr>
              <th>Kriterium</th>
              <th className="w-32 text-right">Vægt</th>
            </tr>
          </thead>
          {vaegttabel.dele.map((del, delIdx) => (
            <tbody key={delIdx}>
              <tr>
                <td colSpan={2} className="bg-paper/60 !py-2 text-[13px] font-semibold text-ink-soft">
                  {del.navn} <span className="num font-normal">({del.totalVaegt} %)</span>
                </td>
              </tr>
              {del.kriterier.map((krit, kritIdx) => (
                <tr key={kritIdx}>
                  <td>
                    <label htmlFor={`v-${delIdx}-${kritIdx}`} className="block">{krit.navn}</label>
                    {krit.beskrivelse && <span className="block text-[13px] text-ink-soft line-clamp-2">{krit.beskrivelse}</span>}
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <input
                        id={`v-${delIdx}-${kritIdx}`}
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={krit.vaegt}
                        onChange={(e) => onChange(delIdx, kritIdx, e.target.value)}
                        className="input num h-8 w-20 text-right"
                      />
                      <span className="text-ink-soft">%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className={`num text-sm ${ok ? 'text-ink-soft' : 'text-pen font-semibold'}`}>
          I alt {sum} %{!ok && ' – vægtene bør give 100 %'}
        </p>
        <button type="button" className="btn-primary" onClick={onSave} disabled={!dirty || saving}>
          {saving && <Loader2 />} Gem vægte
        </button>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import { useExams } from '../hooks/useExams.js';
import { ExamShell } from '../components/ExamShell.jsx';
import { Layout } from '../components/Layout.jsx';
import { Loader2, Trash2, Upload, ExternalLink } from '../components/Icons.jsx';
import { Spinner, Notice, EmptyState, GradeMark, GradeLegend, StatusPill, useConfirm } from '../components/ui.jsx';
import { getAllClasses, getStudents } from '../services/classService.js';
import { uploadStudentSubmission, getFileDownloadURL } from '../services/storageService.js';
import { addSubmission, getSubmissions, deleteSubmission, getGradingResults } from '../services/firestoreService.js';
import { matchFilesToStudents, checkSubmissionFile } from '../utils/matchFiles.js';

/**
 * Trin 2: Besvarelser – én række pr. elev i klassen.
 */
export function StudentMatrixPage() {
  const { examId } = useParams();
  const confirm = useConfirm();
  const { exams, loading: loadingExams, refreshExams } = useExams();

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [gradingResults, setGradingResults] = useState([]);
  const [busyStudentId, setBusyStudentId] = useState(null);
  const [bulk, setBulk] = useState(null); // { matches, unmatched, errors } før upload
  const [bulkUploading, setBulkUploading] = useState(false);
  const [error, setError] = useState(null);
  const bulkInputRef = useRef(null);

  const reloadData = useCallback(async () => {
    const [subs, results] = await Promise.all([getSubmissions(examId), getGradingResults(examId)]);
    setSubmissions(subs);
    setGradingResults(results);
  }, [examId]);

  useEffect(() => {
    const current = exams.find(e => e.id === examId);
    if (!current) {
      if (!loadingExams && exams.length > 0) { setError('Prøven findes ikke'); setLoading(false); }
      return;
    }
    setExam(current);
    if (students.length > 0) return; // Allerede indlæst – opdater kun prøven

    (async () => {
      try {
        setLoading(true);
        const classes = await getAllClasses();
        const examClass = classes.find(c => c.className === current.klasse);
        setStudents(examClass ? await getStudents(examClass.id) : []);
        await reloadData();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [examId, exams, loadingExams]); // eslint-disable-line react-hooks/exhaustive-deps

  const submissionFor = (student) => submissions.find(sub => sub.id === `${student.studentNumber}_${student.studentName}`);
  const resultFor = (submission) => submission && gradingResults.find(r => r.submissionId === submission.id);

  // ---------- Upload ----------

  const uploadForStudent = async (student, file) => {
    const fejl = checkSubmissionFile(file);
    if (fejl) throw new Error(fejl);
    const ext = file.name.split('.').pop().toLowerCase();
    const fileName = `${student.studentNumber}_${student.studentName}.${ext}`;
    const uploadResult = await uploadStudentSubmission(examId, file, fileName);
    await addSubmission(examId, {
      fileName,
      originalFileName: file.name,
      storagePath: uploadResult.storagePath,
      fileSize: file.size,
      contentType: file.type
    });
  };

  const handleSingleUpload = async (student, file) => {
    if (!file) return;
    try {
      setBusyStudentId(student.id);
      await uploadForStudent(student, file);
      await reloadData();
      await refreshExams();
      toast.success(`Besvarelsen for ${student.studentName} er uploadet`);
    } catch (err) {
      toast.error(`Upload mislykkedes: ${err.message}`);
    } finally {
      setBusyStudentId(null);
    }
  };

  const handleBulkSelect = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    const errors = files.map(checkSubmissionFile).filter(Boolean);
    const valid = files.filter(f => !checkSubmissionFile(f));
    // Elever der allerede har en besvarelse, tages ikke med automatisk
    const ledige = students.filter(s => !submissionFor(s));
    const { matches, unmatched } = matchFilesToStudents(valid, ledige);
    setBulk({ matches, unmatched, errors });
  };

  const handleBulkUpload = async () => {
    if (!bulk?.matches.length) return;
    setBulkUploading(true);
    let ok = 0;
    for (const { student, file } of bulk.matches) {
      try {
        setBusyStudentId(student.id);
        await uploadForStudent(student, file);
        ok++;
      } catch (err) {
        toast.error(`${student.studentName}: ${err.message}`);
      }
    }
    setBusyStudentId(null);
    await reloadData();
    await refreshExams();
    setBulkUploading(false);
    setBulk(null);
    toast.success(`${ok} ${ok === 1 ? 'besvarelse' : 'besvarelser'} uploadet`);
  };

  // ---------- Åbn og slet ----------

  const openSubmission = async (submission) => {
    try {
      window.open(await getFileDownloadURL(submission.storagePath), '_blank', 'noopener');
    } catch (err) {
      toast.error(`Filen kunne ikke åbnes: ${err.message}`);
    }
  };

  const handleDelete = async (student) => {
    const submission = submissionFor(student);
    if (!submission) return;
    const graded = Boolean(resultFor(submission));

    const ok = await confirm({
      title: `Slet besvarelsen for ${student.studentName}?`,
      message: graded
        ? 'Filen, AI-forslaget og din godkendte karakter slettes permanent.'
        : 'Filen slettes. Den er ikke rettet endnu.',
      confirmLabel: 'Slet besvarelse',
      danger: true
    });
    if (!ok) return;

    try {
      setBusyStudentId(student.id);
      await deleteSubmission(examId, submission.id, submission.storagePath);
      await reloadData();
      await refreshExams();
      toast.success('Besvarelsen er slettet');
    } catch (err) {
      toast.error(`Besvarelsen kunne ikke slettes: ${err.message}`);
    } finally {
      setBusyStudentId(null);
    }
  };

  // ---------- Visning ----------

  if (!exam) {
    return <Layout>{error ? <Notice title={error} /> : <Spinner label="Indlæser prøve…" />}</Layout>;
  }

  const uploadedCount = students.filter(s => submissionFor(s)).length;
  const gradedCount = students.filter(s => resultFor(submissionFor(s))).length;
  const missingCount = students.length - uploadedCount;

  return (
    <ExamShell
      exam={exam}
      step="besvarelser"
      actions={uploadedCount > 0 && <Link to={`/exams/${examId}`} className="btn-primary">Fortsæt til retning</Link>}
    >
      {loading ? (
        <Spinner label="Indlæser elever…" />
      ) : error ? (
        <Notice title="Data kunne ikke indlæses">{error}</Notice>
      ) : students.length === 0 ? (
        <div className="surface">
          <EmptyState title={`Klasse ${exam.klasse} har ingen elever`} action={<Link to="/klasser" className="btn-primary">Gå til Klasser</Link>}>
            Tilføj eleverne under Klasser. Så får hver elev en række her, hvor besvarelsen kan uploades.
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Masse-upload */}
          <div
            className="surface p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleBulkSelect(e.dataTransfer.files); }}
          >
            <div className="flex-1">
              <p className="font-semibold">
                <span className="num">{uploadedCount}</span> af <span className="num">{students.length}</span> besvarelser uploadet
                {missingCount > 0 && <span className="font-normal text-ink-soft">, {missingCount} mangler</span>}
              </p>
              <p className="text-sm text-ink-soft">Træk filerne hertil, eller vælg flere på én gang. Filnavnet skal indeholde elevens navn eller nummer.</p>
            </div>
            <input ref={bulkInputRef} type="file" multiple accept=".pdf,.docx,.txt" className="sr-only" onChange={(e) => { handleBulkSelect(e.target.files); e.target.value = ''; }} />
            <button type="button" className="btn-secondary" onClick={() => bulkInputRef.current?.click()} disabled={missingCount === 0}>
              <Upload className="w-4 h-4" /> Upload flere filer
            </button>
          </div>

          {bulk && (
            <BulkPreview bulk={bulk} uploading={bulkUploading} onConfirm={handleBulkUpload} onCancel={() => setBulk(null)} />
          )}

          {/* Elevtabel */}
          <div className="surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-12 text-right">Nr.</th>
                    <th>Elev</th>
                    <th className="hidden sm:table-cell">Besvarelse</th>
                    <th className="w-36">Karakter</th>
                    <th className="w-12"><span className="sr-only">Handlinger</span></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const submission = submissionFor(student);
                    const result = resultFor(submission);
                    const busy = busyStudentId === student.id;
                    const approved = result?.finalGrade?.source === 'teacher';
                    const karakter = result
                      ? (exam.type === 'Dansk' ? result.finalGrade?.afrundetKarakter : result.finalGrade?.karakter)
                      : null;

                    return (
                      <tr key={student.id} className="group">
                        <td className="num text-right text-ink-soft">{student.studentNumber}</td>
                        <td>
                          <span className="font-medium">{student.studentName}</span>
                          <div className="sm:hidden mt-1.5 text-sm">
                          {busy ? (
                            <span className="inline-flex items-center gap-2 text-ink-soft"><Loader2 /> Arbejder…</span>
                          ) : submission ? (
                            <button type="button" onClick={() => openSubmission(submission)} className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                              Se fil
                              <ExternalLink className="w-3.5 h-3.5 text-ink-soft" />
                            </button>
                          ) : (
                            <label className="btn-secondary btn-sm cursor-pointer">
                              <Upload className="w-3.5 h-3.5" /> Upload
                              <input type="file" accept=".pdf,.docx,.txt" className="sr-only" onChange={(e) => { handleSingleUpload(student, e.target.files?.[0]); e.target.value = ''; }} />
                            </label>
                          )}
                          </div>
                        </td>
                        <td className="hidden sm:table-cell">
                          {busy ? (
                            <span className="inline-flex items-center gap-2 text-ink-soft"><Loader2 /> Arbejder…</span>
                          ) : submission ? (
                            <button type="button" onClick={() => openSubmission(submission)} className="inline-flex items-center gap-1.5 text-sm underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                              {submission.originalFileName || submission.fileName}
                              <ExternalLink className="w-3.5 h-3.5 text-ink-soft" />
                            </button>
                          ) : (
                            <label className="btn-secondary btn-sm cursor-pointer">
                              <Upload className="w-3.5 h-3.5" /> Upload
                              <input type="file" accept=".pdf,.docx,.txt" className="sr-only" onChange={(e) => { handleSingleUpload(student, e.target.files?.[0]); e.target.value = ''; }} />
                            </label>
                          )}
                        </td>
                        <td>
                          {result ? (
                            <GradeMark karakter={karakter} approved={approved} size="sm" />
                          ) : submission ? (
                            <StatusPill>Ikke rettet</StatusPill>
                          ) : (
                            <StatusPill tone="attention">Mangler</StatusPill>
                          )}
                        </td>
                        <td className="text-right">
                          {submission && (
                            <button
                              type="button"
                              className="btn-icon md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                              onClick={() => handleDelete(student)}
                              disabled={busy}
                              aria-label={`Slet besvarelsen for ${student.studentName}`}
                              title="Slet besvarelse"
                            >
                              <Trash2 />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {gradedCount > 0 && (
              <div className="px-4 py-3 border-t border-line">
                <GradeLegend />
              </div>
            )}
          </div>
        </div>
      )}
    </ExamShell>
  );
}

function BulkPreview({ bulk, uploading, onConfirm, onCancel }) {
  const { matches, unmatched, errors } = bulk;
  return (
    <section className="surface p-5" aria-labelledby="bulk-title">
      <h2 id="bulk-title" className="text-[17px] font-semibold">
        {matches.length > 0 ? `${matches.length} ${matches.length === 1 ? 'fil passer' : 'filer passer'} til elever` : 'Ingen filer kunne matches'}
      </h2>
      {matches.length > 0 && (
        <ul className="mt-3 divide-y divide-line border border-line rounded-control text-sm">
          {matches.map(({ file, student }) => (
            <li key={student.id} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-3 py-2">
              <span className="sm:w-56 font-medium">{student.studentName}</span>
              <span className="text-ink-soft truncate">{file.name}</span>
            </li>
          ))}
        </ul>
      )}
      {(unmatched.length > 0 || errors.length > 0) && (
        <div className="mt-3 text-sm">
          {unmatched.length > 0 && (
            <p className="text-ink-soft">
              Ikke matchet ({unmatched.length}): {unmatched.map(f => f.name).join(', ')}. Upload dem på elevens række.
            </p>
          )}
          {errors.map((e, i) => <p key={i} className="text-pen">{e}</p>)}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-primary" onClick={onConfirm} disabled={uploading || matches.length === 0}>
          {uploading && <Loader2 />} Upload {matches.length} {matches.length === 1 ? 'fil' : 'filer'}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={uploading}>Annuller</button>
      </div>
    </section>
  );
}

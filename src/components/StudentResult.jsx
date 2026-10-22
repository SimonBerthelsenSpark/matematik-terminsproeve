/**
 * Matematik: én elevs retning. Læreren tjekker point pr. opgave og godkender karakteren.
 */
import React, { useState, useEffect, useCallback, Fragment } from 'react';
import toast from 'react-hot-toast';
import { OpgaveDetails } from './OpgaveDetails.jsx';
import { PdfPane } from './PdfPane.jsx';
import { BesvarelseForbrug } from './UsageInfo.jsx';
import { getFileDownloadURL } from '../services/storageService.js';
import { getSubmissions } from '../services/firestoreService.js';
import { lookupKarakter, formatKarakter } from '../utils/karakter.js';
import { GradeMark, Notice } from './ui.jsx';
import { ExternalLink, ChevronDown, Loader2 } from './Icons.jsx';

const PDF_PREF_KEY = 'visBesvarelseVedSiden';
const læsPdfPref = () => {
    try { return localStorage.getItem(PDF_PREF_KEY) !== '0'; } catch { return true; }
};

const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

export function StudentResult({
    result,
    index,
    editMode = false,
    tempPoints = {},
    detailedFeedback = {},
    loadingDetailedFeedback = null,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onUpdatePoint,
    onAskAIDetails,
    examId,
    submissions = null,
    omsaetningstabel = null,
    submissionFile = null,
    onPrint = null
}) {
    const [submissionPath, setSubmissionPath] = useState(null);
    const [openOpgave, setOpenOpgave] = useState(null);
    const [showPdf, setShowPdf] = useState(læsPdfPref);
    const [pdfPage, setPdfPage] = useState(null);
    const sideBySideRef = React.useRef(null);
    const [bredSkærm, setBredSkærm] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches);

    useEffect(() => {
        const mq = window.matchMedia?.('(min-width: 1024px)');
        if (!mq) return;
        const on = () => setBredSkærm(mq.matches);
        mq.addEventListener?.('change', on);
        return () => mq.removeEventListener?.('change', on);
    }, []);

    const togglePdf = () => {
        setShowPdf(v => {
            try { localStorage.setItem(PDF_PREF_KEY, v ? '0' : '1'); } catch { /* ignorér */ }
            return !v;
        });
    };

    // Hentes kun hvis filen ikke allerede er indlæst på siden
    const loadFile = useCallback(async () => {
        if (!submissionPath) return null;
        const res = await fetch(await getFileDownloadURL(submissionPath));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
    }, [submissionPath]);
    const harPdf = Boolean(submissionFile || submissionPath);
    const vedSiden = showPdf && harPdf && bredSkærm;

    // Når eleven åbnes ved siden af besvarelsen, fylder de to vinduer skærmen
    useEffect(() => {
        if (!vedSiden || !sideBySideRef.current) return;
        const t = setTimeout(() => {
            sideBySideRef.current?.scrollIntoView({
                block: 'start',
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
            });
        }, 50);
        return () => clearTimeout(t);
    }, [vedSiden]);

    const vælgOpgave = (i) => {
        const åben = openOpgave === i ? null : i;
        setOpenOpgave(åben);
        const side = åben !== null ? opgaver[åben]?.side : null;
        if (side) setPdfPage(side);
    };
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            if (!examId || !result.submissionId) return;
            try {
                const list = submissions ?? await getSubmissions(examId);
                let submission = list.find(sub => sub.id === result.submissionId);
                if (!submission && result.fileName) {
                    const base = result.fileName.replace(/\.[^/.]+$/, '');
                    submission = list.find(sub => sub.id === base || sub.fileName === result.fileName);
                }
                if (submission?.storagePath) setSubmissionPath(submission.storagePath);
            } catch (err) {
                console.debug('Kunne ikke finde besvarelsens fil:', err.message);
            }
        };
        load();
    }, [examId, result.submissionId, result.fileName, submissions]);

    const openSubmission = async () => {
        try {
            window.open(await getFileDownloadURL(submissionPath), '_blank', 'noopener');
        } catch (err) {
            toast.error('Besvarelsen kunne ikke åbnes: ' + err.message);
        }
    };

    const opgaver = result.opgaver || [];
    const approved = result.lærerKarakter !== undefined && result.lærerKarakter !== null;
    const pointFor = (opgave, i) => {
        const t = tempPoints[`${index}-${i}`];
        if (t !== undefined) return parseFloat(t) || 0;
        if (opgave.lærerPoint !== undefined) return opgave.lærerPoint;
        return opgave.givetPoint || 0;
    };
    const maxTotal = opgaver.reduce((s, o) => s + (Number(o.maxPoint) || 0), 0);
    const dineTotal = opgaver.reduce((s, o, i) => s + pointFor(o, i), 0);
    const preview = omsaetningstabel?.length ? lookupKarakter(omsaetningstabel, dineTotal) : null;
    const changed = opgaver.some((o, i) => pointFor(o, i) !== (o.givetPoint || 0));
    const live = editMode || (!approved && changed);
    const shownKarakter = live
        ? (preview ?? (approved ? result.lærerKarakter : result.karakter))
        : (approved ? result.lærerKarakter : result.karakter);

    const handleApprove = async () => {
        setSaving(true);
        try { await onSaveEdit(); } finally { setSaving(false); }
    };

    const tabel = (
            <div className="surface overflow-hidden min-w-0">
                {opgaver.length === 0 ? (
                    <p className="p-5 text-sm text-ink-soft">Denne retning har ingen detaljer pr. opgave.</p>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Opgave</th>
                                <th className="hidden sm:table-cell w-16 text-right">Maks</th>
                                <th className="w-16 text-right">AI</th>
                                <th className="w-20 sm:w-28 text-right"><span className="sm:hidden">Dine</span><span className="hidden sm:inline">Dine point</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {opgaver.map((opgave, i) => {
                                const key = `${index}-${i}`;
                                const open = openOpgave === i;
                                const dine = pointFor(opgave, i);
                                const afviger = dine !== (opgave.givetPoint || 0);
                                return (
                                    <Fragment key={i}>
                                        <tr className={open ? '[&>td]:border-b-0' : ''}>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => vælgOpgave(i)}
                                                    aria-expanded={open}
                                                    className="flex items-start gap-2 text-left w-full group"
                                                >
                                                    <ChevronDown className={`w-4 h-4 mt-0.5 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
                                                    <span className="min-w-0">
                                                        <span className="block font-medium">
                                                            Opgave {opgave.nummer}
                                                            {opgave.side ? <span className="ml-2 align-middle text-[12px] font-normal text-ink-faint">s. {opgave.side}</span> : null}
                                                            {opgave.usikker && <span className="ml-2 align-middle inline-flex h-5 px-1.5 items-center rounded-full bg-pen-soft text-pen text-[11.5px] font-semibold" title={opgave.usikkerhed || 'AI er usikker'}>Tjek</span>}
                                                        </span>
                                                        {opgave.feedback && <span className={`block text-[13px] text-ink-soft ${open ? '' : 'line-clamp-1'}`}>{opgave.feedback}</span>}
                                                        {open && opgave.usikker && opgave.usikkerhed && <span className="block mt-1 text-[13px] text-pen">Tjek: {opgave.usikkerhed}</span>}
                                                    </span>
                                                </button>
                                            </td>
                                            <td className="hidden sm:table-cell num text-right text-ink-soft">{fmt(opgave.maxPoint ?? 0)}</td>
                                            <td className="num text-right">{fmt(opgave.givetPoint ?? 0)}</td>
                                            <td className="text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={opgave.maxPoint}
                                                    step="0.5"
                                                    inputMode="decimal"
                                                    value={tempPoints[key] !== undefined ? tempPoints[key] : dine}
                                                    onChange={(e) => {
                                                        if (!editMode && onStartEdit) onStartEdit();
                                                        onUpdatePoint(index, i, e.target.value);
                                                    }}
                                                    className={`input num h-8 w-16 sm:w-20 text-right ml-auto ${afviger ? 'border-ink font-semibold' : ''}`}
                                                    aria-label={`Dine point for opgave ${opgave.nummer} (maks ${opgave.maxPoint})`}
                                                />
                                            </td>
                                        </tr>
                                        {open && (
                                            <tr>
                                                <td colSpan={4} className="!pt-0 !px-2 sm:!px-4">
                                                    <OpgaveDetails
                                                        opgave={opgave}
                                                        detailedFeedback={detailedFeedback[key]}
                                                        onAskAI={(q, img) => onAskAIDetails(index, i, q, img)}
                                                        onClearFeedback={() => onAskAIDetails(index, i, null, null, true)}
                                                        loadingDetailedFeedback={loadingDetailedFeedback === key}
                                                    />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
    );

    const panel = (
            <aside className={`space-y-4 ${vedSiden ? '' : 'lg:sticky lg:top-6'}`}>
                <div className="surface p-5">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="text-[13px] text-ink-soft">Point</p>
                            <p className="num text-[22px] font-semibold leading-tight">{fmt(dineTotal)} <span className="text-ink-soft font-normal text-base">/ {fmt(maxTotal)}</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-[13px] text-ink-soft mb-1">Karakter</p>
                            <GradeMark karakter={shownKarakter} approved={approved && !editMode} size="lg" />
                        </div>
                    </div>
                    {(changed || approved) && (
                        <p className="mt-3 text-[13px] text-ink-soft">AI foreslog {fmt(result.totalPoint ?? 0)} point og karakteren {formatKarakter(result.karakter)}.</p>
                    )}
                    <div className="mt-4 flex flex-col gap-2">
                        <button type="button" className="btn-primary w-full" onClick={handleApprove} disabled={saving || (approved && !editMode)}>
                            {saving && <Loader2 />}
                            {approved && !editMode ? 'Godkendt' : approved ? 'Gem ændringer' : changed ? 'Godkend med dine point' : 'Godkend karakter'}
                        </button>
                        {editMode && (
                            <button type="button" className="btn-ghost w-full" onClick={onCancelEdit}>Fortryd ændringer</button>
                        )}
                    </div>
                    {approved && !editMode && <p className="mt-2 text-[13px] text-ok">Ret et pointtal for at ændre karakteren.</p>}
                </div>

                {result.advarsler?.length > 0 && (
                    <Notice title="Tjek denne retning">
                        <ul className="list-disc pl-4 space-y-0.5">
                            {result.advarsler.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                    </Notice>
                )}

                {(result.karakterBegrundelse || result.samletFeedback) && (
                    <div className="text-sm space-y-3 px-1">
                        {result.karakterBegrundelse && (
                            <div>
                                <p className="font-semibold">AI's vurdering</p>
                                <p className="text-ink-soft">{result.karakterBegrundelse}</p>
                            </div>
                        )}
                        {result.samletFeedback && (
                            <div>
                                <p className="font-semibold">Feedback til eleven</p>
                                <p className="text-ink-soft">{result.samletFeedback}</p>
                            </div>
                        )}
                    </div>
                )}

                {onPrint && (
                    <button type="button" className="btn-secondary w-full" onClick={onPrint}>Print feedback til eleven</button>
                )}

                <BesvarelseForbrug result={result} />

                {submissionPath && (
                    <button type="button" onClick={openSubmission} className={`btn-secondary w-full ${vedSiden ? 'hidden' : ''}`}>
                        Se besvarelsen <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                )}
            </aside>
    );

    return (
        <div>
            {harPdf && bredSkærm && (
                <div className="flex justify-end mb-3">
                    <button type="button" onClick={togglePdf} className="text-[13px] text-ink-soft hover:text-ink underline underline-offset-2">
                        {vedSiden ? 'Skjul besvarelsen' : 'Vis besvarelsen ved siden af'}
                    </button>
                </div>
            )}
            {vedSiden ? (
                // To uafhængige rullevinduer i skærmens højde: besvarelsen til venstre, point til højre
                <div ref={sideBySideRef} className="grid gap-5 grid-cols-2 h-[calc(100vh-5rem)] min-h-[30rem] scroll-mt-4">
                    <PdfPane
                        file={submissionFile}
                        loadFile={submissionFile ? undefined : loadFile}
                        page={pdfPage}
                        onOpenExternal={submissionPath ? openSubmission : undefined}
                        className="h-full"
                    />
                    <div className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-contain space-y-5 pr-1" tabIndex={0} aria-label="Point og karakter">
                        {tabel}
                        {panel}
                    </div>
                </div>
            ) : (
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] items-start">
                    {tabel}
                    {panel}
                </div>
            )}
        </div>
    );
}

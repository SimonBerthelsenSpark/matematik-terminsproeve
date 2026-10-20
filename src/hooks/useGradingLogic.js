import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { updateTeacherGrading, recalculateExamStats } from '../services/firestoreService.js';
import { convertPDFToImages, shouldUseVision } from '../utils/pdfToImages.js';
import { callAI, fjernElevnavn, navnFraFilnavn } from '../services/aiService.js';
import { lookupKarakter, parseOmsaetningstabel, normalizeTabel, formatKarakter } from '../utils/karakter.js';

/** Pause mellem elever (sekunder). 429-fejl håndteres desuden med automatisk backoff. */
const PAUSE_MELLEM_ELEVER = 2;

const submissionIdFraFil = (file) => file.name.replace(/\.[^/.]+$/, '');

/**
 * Efterbehandl AI-svaret for matematik:
 * - point klemmes ind i [0, maxPoint]
 * - totalPoint beregnes som summen
 * - karakter slås op i omsætningstabellen (aldrig fra AI)
 */
export function efterbehandlMatematik(aiResult, omsaetningstabel) {
    const advarsler = [];
    const opgaver = (aiResult.opgaver || []).map(opgave => {
        const maxPoint = Math.max(0, Number(opgave.maxPoint) || 0);
        let givetPoint = Number(opgave.givetPoint) || 0;
        if (givetPoint > maxPoint || givetPoint < 0) {
            advarsler.push(`Opgave ${opgave.nummer}: AI gav ${givetPoint} af ${maxPoint} point – rettet til ${Math.min(Math.max(givetPoint, 0), maxPoint)}.`);
            givetPoint = Math.min(Math.max(givetPoint, 0), maxPoint);
        }
        if (opgave.usikker) {
            advarsler.push(`Opgave ${opgave.nummer}: AI er usikker${opgave.usikkerhed ? ` – ${opgave.usikkerhed}` : ''}.`);
        }
        return { ...opgave, givetPoint, maxPoint };
    });

    const totalPoint = opgaver.reduce((sum, o) => sum + o.givetPoint, 0);
    const samletMax = opgaver.reduce((sum, o) => sum + o.maxPoint, 0);
    const tabelMax = Math.max(...normalizeTabel(omsaetningstabel).map(r => r.maxPoint ?? r.minPoint));
    if (Number.isFinite(tabelMax) && samletMax > 0 && Math.abs(samletMax - tabelMax) > 0.01) {
        advarsler.push(`Summen af maxPoint (${samletMax}) passer ikke med omsætningstabellens maksimum (${tabelMax}). Tjek om AI har overset eller opfundet opgaver.`);
    }

    return {
        ...aiResult,
        opgaver,
        totalPoint,
        karakter: lookupKarakter(omsaetningstabel, totalPoint),
        advarsler
    };
}

const normNummer = (n) => String(n ?? '').toLowerCase().replace(/\s+/g, '').replace(/^opgave/, '');
const fmtPoint = (n) => String(Number(n) || 0).replace('.', ',');

/**
 * Sammenlign to uafhængige AI-retninger af samme besvarelse.
 * Første retning bruges som grundlag (point og feedback hænger sammen).
 * Opgaver hvor de to retninger giver forskellige point – eller som kun findes
 * i den ene – markeres som usikre, så læreren ser "Tjek" på dem.
 * @returns {{ result: Object, uenigheder: number }}
 */
export function sammenlignRetninger(a, b) {
    const bMap = new Map((b?.opgaver || []).map(o => [normNummer(o.nummer), o]));
    const brugt = new Set();
    let uenigheder = 0;

    const opgaver = (a?.opgaver || []).map(opgave => {
        const key = normNummer(opgave.nummer);
        const anden = bMap.get(key);
        let grund = null;
        if (!anden) {
            grund = 'Den anden retning fandt ikke denne opgave';
        } else {
            brugt.add(key);
            const p1 = Number(opgave.givetPoint) || 0;
            const p2 = Number(anden.givetPoint) || 0;
            if (Math.abs(p1 - p2) > 0.01) {
                grund = `To uafhængige retninger gav ${fmtPoint(p1)} og ${fmtPoint(p2)} point${anden.feedback ? `. Anden retning: ${anden.feedback}` : ''}`;
            }
        }
        if (!grund) return { ...opgave, retning2Point: anden ? Number(anden.givetPoint) || 0 : null };
        uenigheder++;
        return {
            ...opgave,
            usikker: true,
            usikkerhed: [grund, opgave.usikker ? opgave.usikkerhed : ''].filter(Boolean).join('. '),
            retning2Point: anden ? Number(anden.givetPoint) || 0 : null
        };
    });

    const kunIAnden = (b?.opgaver || []).filter(o => !brugt.has(normNummer(o.nummer)));
    const total = (list) => list.reduce((sum, o) => sum + (Number(o.givetPoint) || 0), 0);

    return {
        result: {
            ...a,
            opgaver,
            dobbeltRetning: {
                total1: total(a?.opgaver || []),
                total2: total(b?.opgaver || []),
                uenigheder,
                kunIAnden: kunIAnden.map(o => String(o.nummer))
            }
        },
        uenigheder: uenigheder + kunIAnden.length
    };
}

/** Advarsler om dobbeltretningen (tilføjes efter efterbehandlingen). */
export function dobbeltRetningAdvarsler(dr) {
    if (!dr) return [];
    const out = [];
    if (dr.enkelt) out.push(`Kun rettet én gang (anden retning fejlede: ${dr.enkelt}). Uenighed kunne ikke tjekkes.`);
    if (dr.kunIAnden?.length) out.push(`Den anden retning fandt også opgave ${dr.kunIAnden.join(', ')}, som ikke er med her. Tjek om en opgave mangler.`);
    if (!dr.enkelt && Math.abs(dr.total1 - dr.total2) > 0.01) {
        out.push(`De to uafhængige retninger gav samlet ${fmtPoint(dr.total1)} og ${fmtPoint(dr.total2)} point (${dr.uenigheder} ${dr.uenigheder === 1 ? 'opgave' : 'opgaver'} med uenighed).`);
    }
    return out;
}

export function useGradingLogic(readFileContent, examId = null, examSettings = null) {
    const [documents, setDocuments] = useState({
        rettevejledning: null,
        omsætningstabel: null,
        elevbesvarelser: []
    });
    const [grading, setGrading] = useState(false);
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
    const [currentStep, setCurrentStep] = useState(1);
    const [statusMessage, setStatusMessage] = useState('');
    const [currentTaskPhase, setCurrentTaskPhase] = useState('');
    const [retryInfo, setRetryInfo] = useState(null);
    const [requestDebugInfo, setRequestDebugInfo] = useState(null);
    const [totalCost, setTotalCost] = useState(0);
    const [editMode, setEditMode] = useState({});
    const [tempLærerPoints, setTempLærerPoints] = useState({});
    const [detailedFeedback, setDetailedFeedback] = useState({});
    const [loadingDetailedFeedback, setLoadingDetailedFeedback] = useState(null);
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionTestResult, setConnectionTestResult] = useState(null);

    // Cache af den fortolkede omsætningstabel (nulstilles når filen skiftes)
    const tabelCache = useRef({ file: null, rows: null });

    /**
     * Hent omsætningstabellen som rækker.
     * 1) Tabel som læreren har gemt på prøven (Rediger prøve) – foretrækkes
     * 2) Ellers fortolkes den uploadede fil
     */
    const getOmsaetningstabel = async () => {
        if (examSettings?.omsaetningstabelData?.length) {
            return normalizeTabel(examSettings.omsaetningstabelData);
        }
        const file = documents.omsætningstabel;
        if (!file) return null;
        if (tabelCache.current.file === file) return tabelCache.current.rows;

        const text = await readFileContent(file);
        const rows = parseOmsaetningstabel(text);
        tabelCache.current = { file, rows };
        return rows;
    };

    const testConnection = async () => {
        setTestingConnection(true);
        setConnectionTestResult(null);
        setError(null);
        try {
            const { model } = await callAI('ping', {}, { maxRetries: 0 });
            setConnectionTestResult({ success: true, message: 'Forbindelse succesfuld!', provider: 'OpenAI', model });
        } catch (err) {
            setConnectionTestResult({ success: false, message: err.message });
        } finally {
            setTestingConnection(false);
        }
    };

    const callAIForSubmission = async (rettevejledning, elevbesvarelse, elevNavn, submissionId, elevFile, omsaetningstabel) => {
        const useVision = shouldUseVision(examSettings, elevFile);

        let pdfImages = [];
        if (useVision) {
            try {
                setCurrentTaskPhase('Konverterer sider til billeder...');
                const { images, truncated, totalPages } = await convertPDFToImages(elevFile);
                pdfImages = images;
                if (truncated) {
                    console.warn(`Vision: kun ${images.length} af ${totalPages} sider sendes som billeder (størrelsesgrænse)`);
                }
            } catch (err) {
                console.error('PDF-konvertering fejlede, bruger kun tekst:', err);
                pdfImages = [];
            }
        }

        // Elevens navn sendes ikke til AI
        const anonymTekst = fjernElevnavn(elevbesvarelse, navnFraFilnavn(elevNavn));

        setRequestDebugInfo({
            endpoint: '/.netlify/functions/grade-exam (gradeMath)',
            rettevejledningSize: `${(rettevejledning.length / 1024).toFixed(2)} KB`,
            elevbesvarelseSize: `${(anonymTekst.length / 1024).toFixed(2)} KB`,
            images: pdfImages.length
        });

        setCurrentTaskPhase('Sender anmodning til AI...');
        setStatusMessage(`📤 Retter ${elevNavn}...`);

        // Ret to gange uafhængigt (parallelt) og sammenlign bagefter
        const payload = { rettevejledning, elevbesvarelse: anonymTekst, pdfImages };
        const opts = (nr) => ({
            onProgress: (sek) => setCurrentTaskPhase(`AI retter besvarelsen to gange uafhængigt… ${sek} sek.`),
            onRetry: (info) => setRetryInfo({ ...info, elevNavn, retning: nr }),
            onWaitTick: (s) => setStatusMessage(`⏳ Venter ${s} sekunder før nyt forsøg...`)
        });
        const [r1, r2] = await Promise.allSettled([callAI('gradeMath', payload, opts(1)), callAI('gradeMath', payload, opts(2))]);
        setRetryInfo(null);

        const ok = [r1, r2].filter(r => r.status === 'fulfilled').map(r => r.value);
        if (!ok.length) throw r1.reason || r2.reason;
        const cost = ok.reduce((sum, r) => sum + (r.cost || 0), 0);
        const model = ok[0].model;
        setTotalCost(prev => prev + cost);

        let aiResult;
        if (ok.length === 2) {
            aiResult = sammenlignRetninger(ok[0].result, ok[1].result).result;
        } else {
            const fejl = [r1, r2].find(r => r.status === 'rejected');
            aiResult = { ...ok[0].result, dobbeltRetning: { enkelt: fejl?.reason?.message || 'ukendt fejl' } };
        }

        const result = efterbehandlMatematik(aiResult, omsaetningstabel);
        result.advarsler.push(...dobbeltRetningAdvarsler(aiResult.dobbeltRetning));
        if (result.advarsler.length) console.warn(`Advarsler for ${elevNavn}:`, result.advarsler);

        return {
            ...result,
            elevNavn,
            fileName: elevNavn,
            submissionId,
            aiModel: model,
            apiCost: cost
        };
    };

    /**
     * @param {Object} [options]
     * @param {boolean} [options.ignoreExisting] - ret alle forfra (bruges efter "slet og ret igen",
     *   hvor `results` i denne closure stadig indeholder de netop slettede resultater)
     */
    const gradeAllExams = async ({ ignoreExisting = false } = {}) => {
        if (!canProceed()) {
            setError('Upload venligst alle nødvendige dokumenter');
            return [];
        }

        setGrading(true);
        setError(null);

        // Fejlede retninger tages med igen, så de kan prøves på ny
        const existingResults = ignoreExisting ? [] : results.filter(r => !r.error);

        try {
            const omsaetningstabel = await getOmsaetningstabel();
            if (!omsaetningstabel || omsaetningstabel.length === 0) {
                throw new Error('Omsætningstabellen kunne ikke læses. Udfyld den under Materiale, før du retter.');
            }

            const rettevejledning = await readFileContent(documents.rettevejledning);

            const gradedSubmissionIds = new Set(
                existingResults.map(r => r.submissionId || r.fileName?.replace(/\.[^/.]+$/, '') || r.elevNavn.replace(/\.[^/.]+$/, ''))
            );
            const newlyGradedResults = [];

            for (let i = 0; i < documents.elevbesvarelser.length; i++) {
                const elevFile = documents.elevbesvarelser[i];
                const submissionId = submissionIdFraFil(elevFile);

                if (gradedSubmissionIds.has(submissionId)) {
                    setStatusMessage(`⏭️ Springer ${submissionId} over - allerede rettet (${i + 1}/${documents.elevbesvarelser.length})`);
                    continue;
                }

                try {
                    setStatusMessage(`📖 Læser ${elevFile.name} (${i + 1}/${documents.elevbesvarelser.length})...`);
                    const elevbesvarelse = await readFileContent(elevFile);
                    const result = await callAIForSubmission(rettevejledning, elevbesvarelse, elevFile.name, submissionId, elevFile, omsaetningstabel);
                    newlyGradedResults.push(result);
                    setResults([...existingResults, ...newlyGradedResults]);

                    if (i < documents.elevbesvarelser.length - 1) {
                        for (let j = PAUSE_MELLEM_ELEVER; j > 0; j--) {
                            setStatusMessage(`⏸️ Venter ${j} sekunder...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                } catch (err) {
                    console.error(`Fejl: ${elevFile.name}`, err);
                    setRetryInfo(null);
                    newlyGradedResults.push({
                        submissionId,
                        fileName: elevFile.name,
                        elevNavn: elevFile.name,
                        error: err.message
                    });
                    setResults([...existingResults, ...newlyGradedResults]);
                }
            }

            const allResults = [...existingResults, ...newlyGradedResults];

            if (newlyGradedResults.length === 0) {
                setStatusMessage('ℹ️ Ingen nye prøver at rette - alle er allerede rettet!');
            } else {
                setStatusMessage(`✅ ${newlyGradedResults.length} nye prøver rettet! (Total: ${allResults.length})`);
            }

            setResults(allResults);
            setCurrentStep(3);
            return newlyGradedResults;
        } catch (err) {
            setError(err.message);
            return [];
        } finally {
            setGrading(false);
        }
    };

    const findElevFil = (result) => documents.elevbesvarelser.find(f =>
        (result.submissionId && submissionIdFraFil(f) === result.submissionId) ||
        (result.fileName && f.name === result.fileName) ||
        f.name === result.elevNavn
    );

    const askAIForDetails = async (resultIdx, opgaveIdx, customQuestion = null, imageBase64 = null, clearOnly = false) => {
        const key = `${resultIdx}-${opgaveIdx}`;

        if (clearOnly) {
            setDetailedFeedback(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            return;
        }

        const result = results[resultIdx];
        const opgave = result.opgaver[opgaveIdx];

        if (!customQuestion && detailedFeedback[key]?.text) return;

        setLoadingDetailedFeedback(key);

        try {
            const opgaveData = {
                nummer: String(opgave.nummer ?? ''),
                givetPoint: opgave.givetPoint,
                maxPoint: opgave.maxPoint,
                elevSvar: opgave.elevSvar || '',
                korrektSvar: opgave.korrektSvar || '',
                feedback: opgave.feedback || ''
            };

            let response;
            if (customQuestion) {
                let fullDocument = '';
                const elevFile = findElevFil(result);
                if (elevFile) {
                    try {
                        fullDocument = fjernElevnavn(await readFileContent(elevFile), navnFraFilnavn(result.elevNavn));
                    } catch (err) {
                        console.error('Kunne ikke læse dokumentet:', err);
                    }
                }
                response = await callAI('askQuestion', {
                    opgave: opgaveData,
                    question: customQuestion,
                    fullDocument,
                    imageBase64: imageBase64 || undefined
                }, { maxRetries: 2 });
            } else {
                response = await callAI('explainTask', { opgave: opgaveData }, { maxRetries: 2 });
            }

            setDetailedFeedback(prev => ({
                ...prev,
                [key]: { loading: false, text: String(response.result).trim(), customQuestion: customQuestion || null }
            }));
            setTotalCost(prev => prev + response.cost);
        } catch (err) {
            setDetailedFeedback(prev => ({
                ...prev,
                [key]: { loading: false, text: `Fejl: ${err.message}`, error: true, customQuestion: customQuestion || null }
            }));
        } finally {
            setLoadingDetailedFeedback(null);
        }
    };

    const startEditing = (resultIdx) => {
        setEditMode(prev => ({ ...prev, [resultIdx]: true }));
        const result = results[resultIdx];
        const initialPoints = {};
        result.opgaver.forEach((opgave, opIdx) => {
            initialPoints[`${resultIdx}-${opIdx}`] = opgave.lærerPoint !== undefined ? opgave.lærerPoint : opgave.givetPoint;
        });
        setTempLærerPoints(prev => ({ ...prev, ...initialPoints }));
    };

    const updateTempLærerPoint = (resultIdx, opgaveIdx, newPoints) => {
        const key = `${resultIdx}-${opgaveIdx}`;
        const opgave = results[resultIdx].opgaver[opgaveIdx];
        const points = Math.max(0, Math.min(parseFloat(newPoints) || 0, opgave.maxPoint));
        setTempLærerPoints(prev => ({ ...prev, [key]: points }));
    };

    const saveLærerGrading = async (resultIdx) => {
        const result = results[resultIdx];
        let lærerTotalPoint = 0;

        const updatedOpgaver = result.opgaver.map((opgave, opIdx) => {
            const key = `${resultIdx}-${opIdx}`;
            const lærerPoint = tempLærerPoints[key] !== undefined
                ? tempLærerPoints[key]
                : (opgave.lærerPoint !== undefined ? opgave.lærerPoint : opgave.givetPoint);
            lærerTotalPoint += lærerPoint;
            return { ...opgave, lærerPoint };
        });

        let omsaetningstabel;
        try {
            omsaetningstabel = await getOmsaetningstabel();
        } catch (err) {
            toast.error(`Kunne ikke læse omsætningstabellen: ${err.message}`);
            return false;
        }

        const lærerKarakter = lookupKarakter(omsaetningstabel, lærerTotalPoint);
        if (lærerKarakter === null) {
            toast.error('Omsætningstabellen kunne ikke læses. Udfyld den under Materiale, og prøv igen.', { duration: 8000 });
            return false;
        }

        setResults(prevResults => {
            const newResults = [...prevResults];
            newResults[resultIdx] = {
                ...newResults[resultIdx],
                opgaver: updatedOpgaver,
                lærerTotalPoint,
                lærerKarakter
            };
            return newResults;
        });
        setEditMode(prev => ({ ...prev, [resultIdx]: false }));

        if (examId && result.id) {
            try {
                await updateTeacherGrading(examId, result.id, {
                    opgaver: updatedOpgaver,
                    totalPoint: lærerTotalPoint,
                    karakter: lærerKarakter
                });
                await recalculateExamStats(examId);
                toast.success(`Godkendt: ${formatKarakter(lærerKarakter)} (${String(lærerTotalPoint).replace('.', ',')} point)`);
            } catch (dbError) {
                console.error('Kunne ikke gemme i databasen:', dbError);
                toast.error('Karakteren er ikke gemt. Tjek forbindelsen, og godkend igen.');
                return false;
            }
        }
        return true;
    };

    const cancelEditing = (resultIdx) => {
        setEditMode(prev => ({ ...prev, [resultIdx]: false }));
        const result = results[resultIdx];
        setTempLærerPoints(prev => {
            const next = { ...prev };
            result.opgaver.forEach((_, opIdx) => delete next[`${resultIdx}-${opIdx}`]);
            return next;
        });
    };

    const harOmsaetningstabel = () =>
        Boolean(documents.omsætningstabel || examSettings?.omsaetningstabelData?.length);

    function canProceed() {
        return Boolean(documents.rettevejledning && harOmsaetningstabel() && documents.elevbesvarelser.length >= 1);
    }

    return {
        documents,
        setDocuments,
        grading,
        results,
        setResults,
        error,
        setError,
        currentStep,
        statusMessage,
        currentTaskPhase,
        retryInfo,
        requestDebugInfo,
        totalCost,
        editMode,
        tempLærerPoints,
        detailedFeedback,
        loadingDetailedFeedback,
        testingConnection,
        connectionTestResult,
        testConnection,
        gradeAllExams,
        askAIForDetails,
        startEditing,
        updateTempLærerPoint,
        saveLærerGrading,
        cancelEditing,
        canProceed
    };
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, Trash2, ChevronDown } from './Icons.jsx';
import { ExamShell } from './ExamShell.jsx';
import { Notice, EmptyState, GradeMark, GradeLegend, StatusPill, Spinner, useConfirm, elevnavnFraFil, elevnummerFraFil } from './ui.jsx';
import { GradingProgress } from './GradingProgress.jsx';
import { StudentResult } from './StudentResult.jsx';
import { DanskStudentResult } from './DanskStudentResult.jsx';
import { useExamContext } from '../hooks/useExamContext.jsx';
import { useSubmissions } from '../hooks/useSubmissions.js';
import { useFileParsing } from '../hooks/useFileParsing.js';
import { useGradingLogic } from '../hooks/useGradingLogic.js';
import { saveGradingResult, recalculateExamStats, getGradingResults, deleteAllGradingResults } from '../services/firestoreService.js';
import { getFileDownloadURL } from '../services/storageService.js';
import { parseDanskBedoemmelse, getCachedParsedBedoemmelse, saveParsedBedoemmelse } from '../utils/danskBedoemmelsesParser.js';
import { bedoemDanskOpgave } from '../hooks/useDanskGrading.js';

export function MathExamGrader() {
    const confirm = useConfirm();
    const [openId, setOpenId] = useState(null);
    // Indlæsning af besvarelsesfiler fra Storage
    const [loadingFiles, setLoadingFiles] = useState(true);
    const [fileProblems, setFileProblems] = useState([]);
    
    // Exam context
    const { examId, exam, updateExamInContext, refreshExam } = useExamContext();
    
    const uploadError = null;
    
    // Submissions hooks
    const {
        submissions,
        loadSubmissions,
        checkFilenameExists,
        addSubmission,
        updateSubmissionStatus
    } = useSubmissions();
    
    // Custom hooks
    const fileParsing = useFileParsing();
    const grading = useGradingLogic(fileParsing.readFileContent, examId, exam);
    
    // Resultater uden fejl – bruges til tællere og statistik, så fejlede retninger kan prøves igen
    const okResults = grading.results.filter(r => !r.error);
    
    // Upload state tracking
    const [uploadedFiles, setUploadedFiles] = useState({
        rettevejledning: null,
        omsætningstabel: null,
        bedoemmelseskema: null,
        submissions: []
    });
    const [uploadStatus, setUploadStatus] = useState('');
    
    // Dansk-specific state
    const [parsedBedoemmelse, setParsedBedoemmelse] = useState(null);
    const [parsingBedoemmelse, setParsingBedoemmelse] = useState(false);
    const [danskGrading, setDanskGrading] = useState(false);
    const [danskStatusMessage, setDanskStatusMessage] = useState('');
    const [danskCurrentTaskPhase, setDanskCurrentTaskPhase] = useState('');
    const [danskTotalCost, setDanskTotalCost] = useState(0);
    
    /**
     * Load existing files from exam context on mount
     */
    useEffect(() => {
        if (!exam || !examId) return;
        
        const loadExistingFiles = async () => {
            setLoadingFiles(true);
            const problems = [];
            try {
                // Hent rettevejledning og omsætningstabel hver for sig, så én fejl ikke stopper resten
                const hentMateriale = async (ref, key, label) => {
                    if (!ref?.storagePath) return;
                    try {
                        const url = await getFileDownloadURL(ref.storagePath);
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const blob = await response.blob();
                        const file = new Blob([blob], { type: ref.contentType });
                        file.name = ref.fileName;
                        file.lastModified = Date.now();
                        grading.setDocuments(prev => ({ ...prev, [key]: file }));
                        setUploadedFiles(prev => ({ ...prev, [key]: ref }));
                    } catch (err) {
                        console.error(`${label} kunne ikke hentes:`, err);
                        problems.push({ name: ref.fileName || label, reason: `${label.toLowerCase()} kunne ikke hentes (${err.code || err.message})` });
                    }
                };
                await hentMateriale(exam.rettevejledningRef, 'rettevejledning', 'Rettevejledningen');
                await hentMateriale(exam.omsætningstabelRef, 'omsætningstabel', 'Omsætningstabellen');

                // Load Bedømmelseskema if exists (DANSK ONLY)
                if (exam.type === 'Dansk' && exam.bedoemmelseskemaRef?.storagePath) {
                    try {
                        const url = await getFileDownloadURL(exam.bedoemmelseskemaRef.storagePath);
                        const response = await fetch(url);
                        const blob = await response.blob();
                        const file = new Blob([blob], { type: exam.bedoemmelseskemaRef.contentType });
                        file.name = exam.bedoemmelseskemaRef.fileName;
                        file.lastModified = Date.now();
                        
                        setUploadedFiles(prev => ({ ...prev, bedoemmelseskema: exam.bedoemmelseskemaRef }));
                        console.log('📄 Loaded existing bedømmelseskema');
                        
                        // Check if vægttabel exists - use it instead of parsing
                        if (exam.vaegttabel) {
                            console.log('✅ Using vægttabel from exam');
                            setParsedBedoemmelse(exam.vaegttabel);
                            setParsingBedoemmelse(false);
                        } else {
                            // Parse bedømmelseskema (check cache first)
                            let parsed = getCachedParsedBedoemmelse(exam);
                            
                            // Validate cached version - check for various issues
                            let needsReparse = false;
                            
                            if (!parsed || !parsed.dele || parsed.dele.length === 0) {
                                needsReparse = true;
                                console.log('⚠️ Cached parsed bedømmelseskema is empty');
                            } else {
                                // Check for invalid criteria or missing weights
                                parsed.dele.forEach(del => {
                                    // Check if section weight is missing
                                    if (del.totalVaegt === null || del.totalVaegt === undefined) {
                                        needsReparse = true;
                                        console.log(`⚠️ Found section without weight: "${del.navn}"`);
                                    }
                                    
                                    del.kriterier.forEach(krit => {
                                        // Check if criterion weight is missing
                                        if (krit.vaegt === null || krit.vaegt === undefined) {
                                            needsReparse = true;
                                            console.log(`⚠️ Found criterion without weight: "${krit.navn}"`);
                                        }
                                        // If a criterion name is suspiciously long (likely a description, not a criterion)
                                        if (krit.navn.split(' ').length > 10) {
                                            needsReparse = true;
                                            console.log(`⚠️ Found invalid criterion in cache: "${krit.navn.substring(0, 60)}..."`);
                                        }
                                    });
                                });
                            }
                            
                            if (needsReparse) {
                                console.log('🔄 Re-parsing bedømmelseskema with updated parser...');
                                setParsingBedoemmelse(true);
                                parsed = await parseDanskBedoemmelse(file);
                                // Save to Firestore for caching
                                await saveParsedBedoemmelse(examId, parsed);
                                console.log('✅ Bedømmelseskema parsed and cached');
                            } else {
                                console.log('✅ Using cached parsed bedømmelseskema');
                            }
                            setParsedBedoemmelse(parsed);
                            setParsingBedoemmelse(false);
                        }
                    } catch (err) {
                        console.error('❌ Error loading/parsing bedømmelseskema:', err);
                        setParsingBedoemmelse(false);
                        grading.setError(`Kunne ikke læse bedømmelseskema: ${err.message}`);
                    }
                }
                
                // Load existing student submissions from Firestore
                console.log('📋 Loading existing submissions...');
                const existingSubmissions = await loadSubmissions(examId);
                
                if (existingSubmissions.length > 0) {
                    console.log(`📄 Found ${existingSubmissions.length} existing submissions, downloading files...`);
                    
                    // Download each submission file
                    const submissionFiles = [];
                    for (const submission of existingSubmissions) {
                        try {
                            // Skip if no storagePath or fileName
                            if (!submission.storagePath || !submission.fileName) {
                                problems.push({ name: submission.fileName || submission.id, reason: 'mangler filoplysninger' });
                                continue;
                            }
                            
                            // Skip if submission was created by system (placeholder)
                            // These are submissions created during grading without actual file uploads
                            if (!/\.pdf$/i.test(submission.fileName) && submission.uploadedBy !== 'system') {
                                problems.push({ name: submission.fileName, reason: 'er ikke en PDF – slet den og upload den igen som PDF' });
                                continue;
                            }

                            if (submission.uploadedBy === 'system') {
                                console.debug(`Skipping system-created placeholder submission: ${submission.fileName}`);
                                continue;
                            }
                            
                            // Attempt to download the file
                            let url;
                            try {
                                url = await getFileDownloadURL(submission.storagePath);
                            } catch (urlError) {
                                problems.push({
                                    name: submission.fileName,
                                    reason: urlError.code === 'storage/object-not-found'
                                        ? 'filen findes ikke længere i lageret'
                                        : `filen kunne ikke findes (${urlError.code || urlError.message})`
                                });
                                continue;
                            }
                            
                            const response = await fetch(url);
                            if (!response.ok) {
                                problems.push({ name: submission.fileName, reason: `filen kunne ikke hentes (HTTP ${response.status})` });
                                continue;
                            }
                            
                            const blob = await response.blob();
                            // Create a File-like object
                            const file = new Blob([blob], { type: submission.contentType || 'application/pdf' });
                            file.name = submission.fileName || 'unknown.pdf';
                            file.lastModified = Date.now();
                            submissionFiles.push(file);
                            console.log(`✅ Loaded submission: ${submission.fileName}`);
                        } catch (err) {
                            // Typisk netværks- eller CORS-fejl ved hentning fra Firebase Storage
                            console.error(`Besvarelsen ${submission.fileName} kunne ikke hentes:`, err);
                            problems.push({ name: submission.fileName || 'ukendt', reason: `filen kunne ikke hentes (${err.message})` });
                        }
                    }
                    
                    // Update grading documents with loaded submissions
                    if (submissionFiles.length > 0) {
                        grading.setDocuments(prev => ({
                            ...prev,
                            elevbesvarelser: submissionFiles
                        }));
                        console.log(`✅ Loaded ${submissionFiles.length} submission files into grading system`);
                    }
                }
                
                setFileProblems(problems);
                setLoadingFiles(false);

                // Load existing grading results from Firestore
                console.log('📊 Loading existing grading results for exam:', examId);
                try {
                    const existingResults = await getGradingResults(examId);
                    console.log('📊 Raw grading results from gradingResults subcollection:', existingResults);
                    
                    if (existingResults && existingResults.length > 0) {
                        console.log(`📄 Found ${existingResults.length} existing grading results in new format`);
                        
                        // ✅ Remove duplicates based on submissionId (AUTORITATIV)
                        const uniqueResults = existingResults.reduce((acc, result) => {
                            const submissionId = result.submissionId || result.id;
                            const existing = acc.find(r => (r.submissionId || r.id) === submissionId);
                            
                            if (!existing) {
                                acc.push(result);
                            } else {
                                console.warn(`⚠️ Duplicate result found for submission ${submissionId} (elevNavn: ${result.elevNavn}), keeping first one`);
                            }
                            return acc;
                        }, []);
                        
                        console.log(`📄 After deduplication: ${uniqueResults.length} unique results`);
                        
                        // Transform Firestore results to match the expected format
                        const transformedResults = uniqueResults.map(result => {
                            console.log('🔄 Transforming result:', result);
                            const aiGrading = result.aiGrading || {};
                            
                            // Check if this is Dansk (has dele) or Matematik (has opgaver)
                            const isDansk = aiGrading.dele && Array.isArray(aiGrading.dele);
                            
                            if (isDansk) {
                                // DANSK result
                                console.log('🔍 Dansk result detected - has dele');
                                return {
                                    submissionId: result.submissionId || result.id,
                                    elevNavn: result.elevNavn || result.submissionId,
                                    fileName: result.fileName || null,
                                    dele: aiGrading.dele || [],
                                    samletKarakter: aiGrading.samletKarakter || 0,
                                    afrundetKarakter: aiGrading.afrundetKarakter || 0,
                                    karakterBegrundelse: aiGrading.karakterBegrundelse || '',
                                    lærerGrading: result.lærerGrading || null,
                                    id: result.id
                                };
                            } else {
                                // MATEMATIK result (original)
                                console.log('🔍 Matematik result detected - has opgaver');
                                
                                const toArray = (opgaver) => Array.isArray(opgaver)
                                    ? opgaver
                                    : (opgaver && typeof opgaver === 'object' ? Object.values(opgaver) : []);
                                
                                // Lærerens opgaver indeholder lærerPoint pr. opgave – brug dem hvis de findes,
                                // ellers mistes lærerens point pr. opgave ved genindlæsning
                                const lærerOpgaver = toArray(result.lærerGrading?.opgaver);
                                const opgaverArray = lærerOpgaver.length > 0 ? lærerOpgaver : toArray(aiGrading.opgaver);
                                
                                return {
                                    submissionId: result.submissionId || result.id,
                                    elevNavn: result.elevNavn || result.submissionId,
                                    fileName: result.fileName || null,
                                    opgaver: opgaverArray,
                                    totalPoint: aiGrading.totalPoint || 0,
                                    karakter: aiGrading.karakter || 0,
                                    karakterBegrundelse: aiGrading.karakterBegrundelse || '',
                                    samletFeedback: aiGrading.samletFeedback || '',
                                    advarsler: aiGrading.advarsler || [],
                                    lærerTotalPoint: result.lærerGrading?.lærerTotalPoint,
                                    lærerKarakter: result.lærerGrading?.lærerKarakter,
                                    id: result.id
                                };
                            }
                        });
                        
                        console.log('🔄 All transformed results:', transformedResults);
                        console.log('🔍 First result opgaver:', transformedResults[0]?.opgaver);
                        
                        // Set the results in the grading logic
                        grading.setResults(transformedResults);
                        console.log(`✅ Loaded and set ${transformedResults.length} grading results from new format`);
                    } else {
                        console.log('ℹ️ No results found in gradingResults subcollection');
                    }
                } catch (err) {
                    console.error('❌ Error loading grading results:', err);
                    console.error('❌ Error stack:', err.stack);
                    grading.setError(`Kunne ikke indlæse rettelser: ${err.message}`);
                }
            } catch (err) {
                console.error('Error loading existing files:', err);
                grading.setError(`Prøvens filer kunne ikke indlæses: ${err.message}`);
            } finally {
                setLoadingFiles(false);
            }
        };
        
        loadExistingFiles();
    }, [exam?.id, examId]); // Only re-run when exam ID changes
    
    
    
    
    /**
     * Delete all grading results
     */
    const handleDeleteAllGradings = async () => {
        if (!examId) return;
        
        const confirmed = await confirm({
            title: 'Slet alle rettelser?',
            message: `${grading.results.length} rettelser slettes – både AI-forslag og dine godkendte karakterer. Besvarelserne bliver liggende, så du kan rette igen.`,
            confirmLabel: 'Slet rettelser',
            danger: true
        });
        
        if (!confirmed) return;
        
        try {
            setUploadStatus('🗑️ Sletter rettelser...');
            
            // Delete all grading results from database
            const deletedCount = await deleteAllGradingResults(examId);
            
            // Clear local results
            grading.setResults([]);
            
            // Refresh exam context
            await refreshExam();
            
            setUploadStatus('');
            toast.success(`${deletedCount} rettelser er slettet`);
        } catch (err) {
            console.error('Error deleting gradings:', err);
            grading.setError(`Fejl ved sletning: ${err.message}`);
        }
    };
    
    /**
     * Grade Dansk exams using dynamic bedømmelseskema
     * Returns the newly graded results array
     */
    const handleGradeDanskExams = async ({ ignoreExisting = false } = {}) => {
        if (!parsedBedoemmelse) {
            grading.setError('Bedømmelseskema ikke parsed endnu. Upload bedømmelseskema først.');
            return [];
        }
        
        if (grading.documents.elevbesvarelser.length === 0) {
            grading.setError('Upload elevbesvarelser først');
            return [];
        }
        
        setDanskGrading(true);
        grading.setError(null);
        
        // Fejlede retninger tages med igen, så de kan prøves på ny
        const existingResults = ignoreExisting ? [] : grading.results.filter(r => !r.error);
        const gradedSubmissionIds = new Set(
            existingResults.map(r => r.submissionId || r.fileName?.replace(/\.[^/.]+$/, ''))
        );
        const newlyGradedResults = [];
        
        try {
            for (let i = 0; i < grading.documents.elevbesvarelser.length; i++) {
                const elevFile = grading.documents.elevbesvarelser[i];
                const submissionId = elevFile.name.replace(/\.[^/.]+$/, '');
                
                // Skip already graded
                if (gradedSubmissionIds.has(submissionId)) {
                    console.log(`⏭️ Skipping ${submissionId} - already graded`);
                    setDanskStatusMessage(`⏭️ Springer ${submissionId} over - allerede rettet (${i + 1}/${grading.documents.elevbesvarelser.length})`);
                    continue;
                }
                
                try {
                    setDanskStatusMessage(`📖 Læser ${elevFile.name} (${i + 1}/${grading.documents.elevbesvarelser.length})...`);
                    const elevbesvarelse = await fileParsing.readFileContent(elevFile);
                    
                    // Validate parsedBedoemmelse before calling AI
                    if (!parsedBedoemmelse || !parsedBedoemmelse.dele || parsedBedoemmelse.dele.length === 0) {
                        throw new Error('Bedømmelseskema er ikke korrekt indlæst. Genindlæs siden eller upload bedømmelseskemaet igen.');
                    }
                    
                    setDanskStatusMessage(`🤖 AI bedømmer ${elevFile.name}...`);
                    const result = await bedoemDanskOpgave(
                        parsedBedoemmelse,
                        elevbesvarelse,
                        elevFile.name,
                        submissionId,
                        (status) => setDanskCurrentTaskPhase(status)
                    );
                    
                    newlyGradedResults.push(result);
                    grading.setResults([...existingResults, ...newlyGradedResults]);
                    
                    // Update cost if available
                    if (result.metadata?.cost) {
                        setDanskTotalCost(prev => prev + result.metadata.cost);
                    }
                    
                    // Kort pause mellem elever (429 håndteres desuden med automatisk backoff)
                    if (i < grading.documents.elevbesvarelser.length - 1) {
                        for (let j = 2; j > 0; j--) {
                            setDanskStatusMessage(`⏸️ Venter ${j} sekunder...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                } catch (err) {
                    console.error(`Fejl ved bedømmelse af ${elevFile.name}:`, err);
                    newlyGradedResults.push({
                        submissionId,
                        fileName: elevFile.name,
                        elevNavn: elevFile.name,
                        error: err.message
                    });
                    grading.setResults([...existingResults, ...newlyGradedResults]);
                }
            }
            
            const allResults = [...existingResults, ...newlyGradedResults];
            
            if (newlyGradedResults.length === 0) {
                setDanskStatusMessage('ℹ️ Ingen nye prøver at rette - alle er allerede rettet!');
            } else {
                setDanskStatusMessage(`✅ ${newlyGradedResults.length} nye prøver rettet!`);
            }
            
            grading.setResults(allResults);
            
            // Return newly graded results for saving
            return newlyGradedResults;
            
        } catch (err) {
            grading.setError(err.message);
            return [];
        } finally {
            setDanskGrading(false);
        }
    };
    
    /**
     * Enhanced grading with database persistence
     * Supports both Matematik and Dansk exams
     */
    const handleGradeAllExams = async () => {
        if (!examId) {
            grading.setError('Ingen eksamen valgt');
            return;
        }
        
        // Check if ALL submissions are already graded
        const totalSubmissions = grading.documents.elevbesvarelser.length;
        const gradedSubmissions = okResults.length;
        
        // Når alt slettes og rettes forfra, må de gamle resultater (som stadig ligger
        // i denne render's state) ikke få retningen til at springe eleverne over
        let ignoreExisting = false;
        if (gradedSubmissions >= totalSubmissions) {
            const confirmed = await confirm({
                title: 'Ret alle igen?',
                message: `Alle ${totalSubmissions} besvarelser er rettet. De nuværende rettelser og dine godkendte karakterer erstattes.`,
                confirmLabel: 'Ret alle igen',
                danger: true
            });
            
            if (!confirmed) {
                return;
            }
            
            // Delete existing gradings
            try {
                setUploadStatus('🗑️ Sletter eksisterende rettelser...');
                await deleteAllGradingResults(examId);
                grading.setResults([]);
                await refreshExam();
                setUploadStatus('');
                ignoreExisting = true;
            } catch (err) {
                console.error('Error deleting gradings:', err);
                grading.setError(`Fejl ved sletning: ${err.message}`);
                return;
            }
        }
        
        // Store the count of results before grading
        const resultsBeforeGrading = ignoreExisting ? 0 : okResults.length;
        
        // Branch based on exam type and get new results
        let newResults = [];
        if (exam?.type === 'Dansk') {
            // DANSK GRADING FLOW - returns newly graded results
            newResults = await handleGradeDanskExams({ ignoreExisting });
        } else {
            // MATEMATIK GRADING FLOW (original logic)
            if (!grading.canProceed()) {
                grading.setError('Upload alle nødvendige dokumenter');
                return;
            }
            // ✅ gradeAllExams now returns the newly graded results
            newResults = await grading.gradeAllExams({ ignoreExisting });
        }
        
        if (newResults.length > 0) {
            try {
                setUploadStatus(`💾 Gemmer ${newResults.length} nye resultater til database...`);
                
                let savedCount = 0;
                let errorCount = 0;
                
                // Save ONLY the new results to gradingResults subcollection
                for (const result of newResults) {
                    if (result.error) {
                        errorCount++;
                        console.warn(`⚠️ Skipping failed grading for: ${result.fileName || result.elevNavn}`);
                        continue;
                    }
                    
                    try {
                        // ✅ KORREKT: Brug submissionId som allerede er sat i result
                        const submissionId = result.submissionId || result.fileName?.replace(/\.[^/.]+$/, '');
                        
                        if (!submissionId) {
                            console.error(`❌ Missing submissionId for result:`, result);
                            errorCount++;
                            continue;
                        }
                        
                        // Prepare grading data - different structure for Matematik vs Dansk
                        let gradingData;
                        
                        if (exam?.type === 'Dansk') {
                            // Dansk: Save dele structure
                            gradingData = {
                                submissionId: submissionId,
                                elevNavn: result.elevNavn,
                                fileName: result.fileName,
                                dele: result.dele || [],
                                samletKarakter: result.samletKarakter || 0,
                                afrundetKarakter: result.afrundetKarakter || 0,
                                karakterBegrundelse: result.karakterBegrundelse || '',
                                aiProvider: 'openai',
                                aiModel: result.metadata?.aiModel || 'ukendt',
                                apiCost: result.metadata?.cost || 0,
                                processingTimeMs: 0
                            };
                        } else {
                            // Matematik: Save opgaver structure (original)
                            gradingData = {
                                submissionId: submissionId,
                                elevNavn: result.elevNavn,
                                fileName: result.fileName,
                                opgaver: result.opgaver || [],
                                totalPoint: result.totalPoint || 0,
                                karakter: result.karakter || 0,
                                karakterBegrundelse: result.karakterBegrundelse || '',
                                samletFeedback: result.samletFeedback || '',
                                advarsler: result.advarsler || [],
                                aiProvider: 'openai',
                                aiModel: result.aiModel || 'ukendt',
                                apiCost: result.apiCost || 0,
                                processingTimeMs: 0
                            };
                        }
                        
                        // Save to gradingResults subcollection (this will auto-create submission if needed)
                        await saveGradingResult(examId, submissionId, gradingData);
                        
                        savedCount++;
                        console.log(`💾 Saved result for: ${submissionId} (elevNavn: ${result.elevNavn})`);
                    } catch (saveError) {
                        errorCount++;
                        console.error(`❌ Failed to save result for ${result.submissionId || result.elevNavn}:`, saveError);
                        // Continue with next result instead of stopping
                    }
                }
                
                console.log(`📊 Saved ${savedCount} out of ${newResults.length} NEW results to gradingResults subcollection`);
                
                // Recalculate exam statistics (only if we saved at least one result)
                if (savedCount > 0) {
                    setUploadStatus('📊 Opdaterer statistik...');
                    try {
                        await recalculateExamStats(examId);
                        
                        // Refresh exam context to show updated stats
                        await refreshExam();
                        
                        setUploadStatus(`✅ ${savedCount} nye resultater gemt!${errorCount > 0 ? ` (${errorCount} fejlede – tryk "Ret" igen for at prøve dem igen)` : ''}`);
                    } catch (statsError) {
                        console.error('Error updating stats:', statsError);
                        setUploadStatus(`✅ ${savedCount} resultater gemt! (Kunne ikke opdatere statistik)`);
                    }
                } else {
                    setUploadStatus('⚠️ Ingen resultater kunne gemmes');
                }
                
                setTimeout(() => setUploadStatus(''), 5000);
            } catch (err) {
                console.error('Error saving results to database:', err);
                grading.setError(`Resultater rettet, men fejl ved gemning: ${err.message}`);
            }
        } else if (resultsBeforeGrading > 0) {
            // All submissions were already graded
            setUploadStatus('ℹ️ Ingen nye rettelser - alle er allerede rettet!');
            setTimeout(() => setUploadStatus(''), 3000);
        }
    };
    


    // ---------- Visning ----------

    const isDansk = exam?.type === 'Dansk';
    const total = grading.documents.elevbesvarelser.length;
    const ungraded = Math.max(0, total - okResults.length);
    const isApproved = (r) => (isDansk ? Boolean(r.lærerGrading) : r.lærerKarakter !== undefined && r.lærerKarakter !== null);
    const aiKarakter = (r) => (isDansk ? r.afrundetKarakter : r.karakter);
    const laererKarakter = (r) => (isDansk ? r.lærerGrading?.afrundetKarakter : r.lærerKarakter);
    const approvedCount = okResults.filter(isApproved).length;
    const isBusy = grading.grading || danskGrading;
    const materialeMangler = isDansk ? !parsedBedoemmelse : !grading.canProceed() && total > 0;

    const rowId = (r, idx) => r.submissionId || r.fileName || String(idx);
    const sorted = grading.results
        .map((r, idx) => ({ r, idx }))
        .sort((a, b) => (Number(elevnummerFraFil(a.r.elevNavn)) || 999) - (Number(elevnummerFraFil(b.r.elevNavn)) || 999));

    // Efter godkendelse: åbn næste elev, der mangler gennemsyn
    const handleApproved = async (idx) => {
        await refreshExam();
        const pos = sorted.findIndex(x => x.idx === idx);
        const next = [...sorted.slice(pos + 1), ...sorted.slice(0, pos)].find(x => !x.r.error && !isApproved(x.r) && x.idx !== idx);
        setOpenId(next ? rowId(next.r, next.idx) : null);
    };

    const gennemsnit = (() => {
        const vals = okResults.map(r => (isApproved(r) ? laererKarakter(r) : aiKarakter(r))).filter(v => typeof v === 'number');
        return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    })();
    const sessionCost = (isDansk ? danskTotalCost : grading.totalCost) || 0;

    return (
        <ExamShell
            exam={exam}
            step="retning"
            actions={(ungraded > 0 || isBusy) &&
                <button
                    type="button"
                    onClick={handleGradeAllExams}
                    disabled={isBusy || ungraded === 0 || !examId || (isDansk ? !parsedBedoemmelse : !grading.canProceed())}
                    className="btn-primary"
                >
                    {isBusy ? <Loader2 /> : null}
                    {isBusy
                        ? `Retter ${okResults.length} af ${total}…`
                        : ungraded > 0
                            ? `Ret ${ungraded} ${ungraded === 1 ? 'besvarelse' : 'besvarelser'}`
                            : 'Alle er rettet'}
                </button>
            }
        >
            <div className="space-y-4">
                {(grading.error || uploadError) && (
                    <Notice title="Noget gik galt">{grading.error || uploadError}</Notice>
                )}

                {materialeMangler && !grading.error && (
                    <Notice tone="info" title="Materialet mangler" action={<Link to={`/exams/${examId}/edit`} className="btn-secondary btn-sm self-center">Gå til materiale</Link>}>
                        {isDansk ? 'Bedømmelseskemaet skal være uploadet og læst, før besvarelserne kan rettes.' : 'Rettevejledning og omsætningstabel skal være på plads, før besvarelserne kan rettes.'}
                    </Notice>
                )}

                {uploadStatus && !isBusy && (
                    <p className="text-sm text-ink-soft" role="status">{uploadStatus}</p>
                )}

                {isBusy && (
                    <GradingProgress
                        statusMessage={isDansk ? danskStatusMessage : grading.statusMessage}
                        currentTaskPhase={isDansk ? danskCurrentTaskPhase : grading.currentTaskPhase}
                        completedCount={okResults.length}
                        totalCount={total}
                        retryInfo={grading.retryInfo}
                        currentFileName={elevnavnFraFil(grading.documents.elevbesvarelser[okResults.length]?.name)}
                    />
                )}

                {loadingFiles && total === 0 && (
                    <div className="surface"><Spinner label="Henter besvarelser…" /></div>
                )}

                {!loadingFiles && fileProblems.length > 0 && (
                    <Notice
                        title={fileProblems.length === 1 ? 'En fil kunne ikke hentes' : `${fileProblems.length} filer kunne ikke hentes`}
                        action={<Link to={`/exams/${examId}/matrix`} className="btn-secondary btn-sm self-center">Gå til besvarelser</Link>}
                    >
                        <ul className="list-disc pl-4">
                            {fileProblems.map((p, i) => <li key={i}>{elevnavnFraFil(p.name) || p.name}: {p.reason}</li>)}
                        </ul>
                        <p className="mt-1">Slet og upload filen igen. Besvarelser ligger under Besvarelser, rettevejledning og omsætningstabel under Materiale.</p>
                    </Notice>
                )}

                {!loadingFiles && total === 0 && grading.results.length === 0 && fileProblems.length === 0 && (
                    <div className="surface">
                        <EmptyState title="Ingen besvarelser at rette" action={<Link to={`/exams/${examId}/matrix`} className="btn-primary">Upload besvarelser</Link>}>
                            Upload elevernes besvarelser, så kan de rettes her.
                        </EmptyState>
                    </div>
                )}

                {grading.results.length > 0 && grading.results[0]?.fromHistory && (
                    <Notice title="Gamle rettelser" action={<button type="button" className="btn-danger btn-sm self-center" onClick={handleDeleteAllGradings}>Slet og ret igen</button>}>
                        Disse rettelser er gemt i et ældre format uden detaljer pr. opgave.
                    </Notice>
                )}

                {grading.results.length > 0 && !grading.results[0]?.fromHistory && (
                    <div className="surface overflow-hidden">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 sm:px-5 py-4 border-b border-line">
                            <p className="text-sm">
                                <span className="font-semibold"><span className="num">{approvedCount}</span> af <span className="num">{okResults.length}</span> godkendt</span>
                                {gennemsnit !== null && <span className="text-ink-soft">. Gennemsnit <span className="num">{gennemsnit.toFixed(1).replace('.', ',')}</span></span>}
                                {approvedCount < okResults.length && <span className="text-ink-soft">. Åbn en elev for at tjekke og godkende karakteren.</span>}
                            </p>
                            <GradeLegend />
                        </div>

                        <div className="hidden sm:grid grid-cols-[2.5rem_minmax(0,1fr)_6rem_5rem_5rem_9rem_1.25rem] gap-x-3 px-5 py-2 border-b border-line bg-paper/60 text-[13px] font-semibold text-ink-soft" aria-hidden="true">
                            <span className="text-right">Nr.</span>
                            <span>Elev</span>
                            <span>{isDansk ? 'Gennemsnit' : 'Point'}</span>
                            <span>AI</span>
                            <span>Din</span>
                            <span>Status</span>
                            <span />
                        </div>
                        <ul>
                            {sorted.map(({ r, idx }) => {
                                const id = rowId(r, idx);
                                const open = openId === id;
                                const approved = !r.error && isApproved(r);
                                return (
                                    <li key={id} className={`border-b border-line last:border-b-0 ${open ? 'bg-paper/40' : ''}`}>
                                        <button
                                            type="button"
                                            onClick={() => setOpenId(open ? null : id)}
                                            aria-expanded={open}
                                            className="w-full grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem_5rem_5rem_9rem_1.25rem] items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-3 text-left hover:bg-paper/60 transition-colors"
                                        >
                                            <span className="hidden sm:block num text-sm text-ink-soft text-right">{elevnummerFraFil(r.elevNavn)}</span>
                                            <span className="font-medium truncate">{elevnavnFraFil(r.elevNavn) || r.elevNavn}</span>
                                            <span className="hidden sm:block num text-sm text-ink-soft">
                                                {!r.error && !isDansk && r.opgaver?.length > 0 && (
                                                    <>{approved ? r.lærerTotalPoint : r.totalPoint} / {r.opgaver.reduce((s, o) => s + (Number(o.maxPoint) || 0), 0)} p</>
                                                )}
                                                {!r.error && isDansk && typeof r.samletKarakter === 'number' && (
                                                    <>{((approved ? r.lærerGrading?.samletKarakter : r.samletKarakter) ?? 0).toFixed(1).replace('.', ',')}</>
                                                )}
                                            </span>
                                            <span className="hidden sm:flex justify-start">
                                                {!r.error && <GradeMark karakter={aiKarakter(r)} size="sm" title="AI-forslag" />}
                                            </span>
                                            <span className="hidden sm:flex justify-start">
                                                {approved && <GradeMark karakter={laererKarakter(r)} approved size="sm" />}
                                            </span>
                                            <span className="flex items-center gap-2 justify-end sm:justify-start">
                                                {!r.error && (
                                                    <span className="sm:hidden">
                                                        <GradeMark karakter={approved ? laererKarakter(r) : aiKarakter(r)} approved={approved} size="sm" />
                                                    </span>
                                                )}
                                                {r.error ? (
                                                    <StatusPill tone="attention">Fejl</StatusPill>
                                                ) : approved ? (
                                                    <StatusPill tone="ok">Godkendt</StatusPill>
                                                ) : (r.advarsler?.length || r.dele?.some(d => d.kriterier?.some(k => k.usikker))) ? (
                                                    <StatusPill tone="attention">Tjek advarsel</StatusPill>
                                                ) : (
                                                    <StatusPill>Til gennemsyn</StatusPill>
                                                )}
                                            </span>
                                            <ChevronDown className={`hidden sm:block w-4 h-4 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
                                        </button>

                                        {open && (
                                            <div className="px-4 sm:px-5 pb-5">
                                                {r.error ? (
                                                    <Notice title="Besvarelsen kunne ikke rettes">
                                                        {r.error} Tryk "Ret {ungraded} {ungraded === 1 ? 'besvarelse' : 'besvarelser'}" øverst for at prøve igen.
                                                    </Notice>
                                                ) : isDansk ? (
                                                    <DanskStudentResult
                                                        result={r}
                                                        index={idx}
                                                        parsedBedoemmelse={parsedBedoemmelse}
                                                        examId={examId}
                                                        submissions={submissions}
                                                        onSave={(i, lærerGrading) => {
                                                            grading.setResults(prev => {
                                                                const updated = [...prev];
                                                                updated[i] = { ...updated[i], lærerGrading };
                                                                return updated;
                                                            });
                                                            handleApproved(i);
                                                        }}
                                                    />
                                                ) : (
                                                    <StudentResult
                                                        result={r}
                                                        index={idx}
                                                        editMode={grading.editMode[idx] || false}
                                                        tempPoints={grading.tempLærerPoints}
                                                        detailedFeedback={grading.detailedFeedback}
                                                        loadingDetailedFeedback={grading.loadingDetailedFeedback}
                                                        onStartEdit={() => grading.startEditing(idx)}
                                                        onSaveEdit={async () => {
                                                            const ok = await grading.saveLærerGrading(idx);
                                                            if (ok) handleApproved(idx);
                                                        }}
                                                        onCancelEdit={() => grading.cancelEditing(idx)}
                                                        onUpdatePoint={grading.updateTempLærerPoint}
                                                        onAskAIDetails={grading.askAIForDetails}
                                                        examId={examId}
                                                        submissions={submissions}
                                                        omsaetningstabel={exam?.omsaetningstabelData}
                                                    />
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {grading.results.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 text-[13px] text-ink-soft">
                        <span>
                            {sessionCost > 0 && <>AI-forbrug i denne session: ca. <span className="num">{(sessionCost * 7).toFixed(2).replace('.', ',')}</span> kr.</>}
                        </span>
                        <button type="button" className="btn-ghost btn-sm text-pen hover:text-pen" onClick={handleDeleteAllGradings} disabled={isBusy}>
                            <Trash2 className="w-3.5 h-3.5" /> Slet alle rettelser
                        </button>
                    </div>
                )}
            </div>
        </ExamShell>
    );
}

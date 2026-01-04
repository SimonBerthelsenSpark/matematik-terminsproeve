import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, AlertCircle, Loader2, Database, File, Users, X, Upload, Eye, EyeOff, Trash2, Calendar, Download, ExternalLink } from './Icons.jsx';
import { GradingProgress } from './GradingProgress.jsx';
import { AdminPanel } from './AdminPanel.jsx';
import { ResultsOverview } from './ResultsOverview.jsx';
import { StudentResult } from './StudentResult.jsx';
import { DanskStudentResult } from './DanskStudentResult.jsx';
import { useExamContext } from '../hooks/useExamContext.jsx';
import { useFileUpload } from '../hooks/useFileUpload.js';
import { useSubmissions } from '../hooks/useSubmissions.js';
import { useFirestore } from '../hooks/useFirestore.js';
import { useFileParsing } from '../hooks/useFileParsing.js';
import { useGradingLogic } from '../hooks/useGradingLogic.js';
import { useFileHandling } from '../hooks/useFileHandling.js';
import { saveGradingResult, recalculateExamStats, getGradingResults, deleteAllGradingResults } from '../services/firestoreService.js';
import { getFileDownloadURL } from '../services/storageService.js';
import { parseDanskBedoemmelse, getCachedParsedBedoemmelse, saveParsedBedoemmelse } from '../utils/danskBedoemmelsesParser.js';
import { bedoemDanskOpgave } from '../hooks/useDanskGrading.js';

/**
 * Format date to DD/MM/YYYY
 */
const formatDate = (date) => {
    if (!date) return '-';
    
    let dateObj;
    if (date.toDate) {
        // Firestore Timestamp
        dateObj = date.toDate();
    } else if (date instanceof Date) {
        dateObj = date;
    } else {
        dateObj = new Date(date);
    }

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Get badge color based on exam type
 */
const getTypeBadgeColor = (type) => {
    if (type === 'Matematik') {
        return 'bg-blue-100 text-blue-800 border-blue-200';
    } else if (type === 'Dansk') {
        return 'bg-green-100 text-green-800 border-green-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
};

export function MathExamGrader() {
    const db = window.db;
    const [showLogPanel, setShowLogPanel] = useState(false);
    const [showSubmissionsList, setShowSubmissionsList] = useState(false);
    
    // Exam context
    const { examId, exam, updateExamInContext, refreshExam } = useExamContext();
    
    // File upload hooks
    const {
        uploadRettevejledning,
        uploadOmsaetningstabel,
        uploadBedoemmelseskema,
        uploadSubmission,
        uploading,
        uploadProgress,
        error: uploadError
    } = useFileUpload();
    
    // Submissions hooks
    const {
        submissions,
        loadSubmissions,
        checkFilenameExists,
        addSubmission,
        updateSubmissionStatus
    } = useSubmissions();
    
    // Custom hooks
    const firestore = useFirestore(db, examId);
    const fileParsing = useFileParsing();
    const grading = useGradingLogic(fileParsing.readFileContent, firestore.saveToHistory, examId);
    const fileHandling = useFileHandling(fileParsing.getAllFilesFromEntry, grading.setDocuments, grading.setError);
    
    // Upload state tracking
    const [uploadedFiles, setUploadedFiles] = useState({
        rettevejledning: null,
        omsætningstabel: null,
        bedoemmelseskema: null,
        submissions: []
    });
    const [uploadStatus, setUploadStatus] = useState('');
    const [duplicateFiles, setDuplicateFiles] = useState([]);
    
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
            try {
                // Load Rettevejledning if exists
                if (exam.rettevejledningRef?.storagePath) {
                    const url = await getFileDownloadURL(exam.rettevejledningRef.storagePath);
                    const response = await fetch(url);
                    const blob = await response.blob();
                    // Create a File-like object that's compatible with production builds
                    const file = new Blob([blob], { type: exam.rettevejledningRef.contentType });
                    file.name = exam.rettevejledningRef.fileName;
                    file.lastModified = Date.now();
                    
                    grading.setDocuments(prev => ({ ...prev, rettevejledning: file }));
                    setUploadedFiles(prev => ({ ...prev, rettevejledning: exam.rettevejledningRef }));
                    console.log('📄 Loaded existing rettevejledning');
                }
                
                // Load Omsætningstabel if exists (MATEMATIK ONLY)
                if (exam.omsætningstabelRef?.storagePath) {
                    const url = await getFileDownloadURL(exam.omsætningstabelRef.storagePath);
                    const response = await fetch(url);
                    const blob = await response.blob();
                    // Create a File-like object that's compatible with production builds
                    const file = new Blob([blob], { type: exam.omsætningstabelRef.contentType });
                    file.name = exam.omsætningstabelRef.fileName;
                    file.lastModified = Date.now();
                    
                    grading.setDocuments(prev => ({ ...prev, omsætningstabel: file }));
                    setUploadedFiles(prev => ({ ...prev, omsætningstabel: exam.omsætningstabelRef }));
                    console.log('📄 Loaded existing omsætningstabel');
                }
                
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
                        
                        // Parse bedømmelseskema (check cache first)
                        let parsed = getCachedParsedBedoemmelse(exam);
                        
                        // Validate cached version - if empty, re-parse
                        const isCachedValid = parsed && parsed.dele && parsed.dele.length > 0;
                        
                        if (!parsed || !isCachedValid) {
                            if (parsed && !isCachedValid) {
                                console.log('⚠️ Cached parsed bedømmelseskema is invalid (empty), re-parsing...');
                            } else {
                                console.log('📋 Parsing bedømmelseskema...');
                            }
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
                                console.debug(`Submission has incomplete data, skipping:`, submission);
                                continue;
                            }
                            
                            // Skip if submission was created by system (placeholder)
                            // These are submissions created during grading without actual file uploads
                            if (submission.uploadedBy === 'system') {
                                console.debug(`Skipping system-created placeholder submission: ${submission.fileName}`);
                                continue;
                            }
                            
                            // Attempt to download the file
                            let url;
                            try {
                                url = await getFileDownloadURL(submission.storagePath);
                            } catch (urlError) {
                                // File doesn't exist in storage - this shouldn't happen for real uploads
                                // but can happen if files were deleted from storage
                                console.debug(`File not found in storage: ${submission.storagePath}, skipping`);
                                continue;
                            }
                            
                            const response = await fetch(url);
                            if (!response.ok) {
                                console.warn(`⚠️ Failed to fetch file ${submission.fileName}: ${response.status}`);
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
                            // Silently skip failed submissions - don't spam console
                            console.debug(`Skipped submission ${submission.fileName || 'unknown'}:`, err.message);
                            // Continue processing other submissions
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
                                
                                let opgaverArray = [];
                                if (Array.isArray(aiGrading.opgaver)) {
                                    opgaverArray = aiGrading.opgaver;
                                } else if (aiGrading.opgaver && typeof aiGrading.opgaver === 'object') {
                                    opgaverArray = Object.values(aiGrading.opgaver);
                                    console.log('⚠️ Converted opgaver object to array:', opgaverArray);
                                }
                                
                                return {
                                    submissionId: result.submissionId || result.id,
                                    elevNavn: result.elevNavn || result.submissionId,
                                    fileName: result.fileName || null,
                                    opgaver: opgaverArray,
                                    totalPoint: aiGrading.totalPoint || 0,
                                    karakter: aiGrading.karakter || 0,
                                    karakterBegrundelse: aiGrading.karakterBegrundelse || '',
                                    samletFeedback: aiGrading.samletFeedback || '',
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
                        console.log('ℹ️ No results in new gradingResults subcollection, checking old gradingHistory collection...');
                        
                        // Fallback: Load from old gradingHistory collection
                        // Load history and get the returned value directly (don't rely on state)
                        console.log('📄 Loading gradingHistory from Firestore...');
                        const loadedHistory = await firestore.loadHistoryFromFirestore();
                        console.log('📄 Loaded history entries:', loadedHistory?.length || 0);
                        console.log('📄 History data:', loadedHistory);
                        
                        if (loadedHistory && loadedHistory.length > 0) {
                            console.log(`📄 Found ${loadedHistory.length} entries in gradingHistory collection`);
                            
                            // Find the most recent history entry for this exam
                            const historyEntry = loadedHistory.find(entry => {
                                console.log('🔍 Checking entry:', entry.id, 'examId:', entry.examId, 'target:', examId);
                                console.log('🔍 Entry opgaver:', entry.opgaver);
                                console.log('🔍 Opgaver type:', typeof entry.opgaver);
                                console.log('🔍 Opgaver isArray:', Array.isArray(entry.opgaver));
                                console.log('🔍 Opgaver keys:', entry.opgaver ? Object.keys(entry.opgaver) : 'null');
                                
                                return entry.examId === examId && entry.opgaver;
                            });
                            
                            console.log('📄 Selected history entry:', historyEntry);
                            
                            if (historyEntry && historyEntry.opgaver) {
                                // Convert opgaver to array if it's an object (handles sparse arrays from Firestore)
                                let opgaverArray = historyEntry.opgaver;
                                if (!Array.isArray(opgaverArray) && typeof opgaverArray === 'object') {
                                    console.log('⚠️ Opgaver is object, converting to array');
                                    opgaverArray = Object.values(opgaverArray);
                                }
                                console.log('📄 Opgaver array after conversion:', opgaverArray);
                                console.log('📄 Opgaver array length:', opgaverArray.length);
                                
                                // Check if opgaver has the NEW detailed format with individual exercise data
                                const hasDetailedData = opgaverArray.length > 0 &&
                                    opgaverArray[0].opgaver &&
                                    Array.isArray(opgaverArray[0].opgaver);
                                
                                console.log('🔍 Has detailed data:', hasDetailedData);
                                if (opgaverArray.length > 0) {
                                    console.log('🔍 First student in opgaverArray:', opgaverArray[0]);
                                    console.log('🔍 First student opgaver field:', opgaverArray[0].opgaver);
                                }
                                
                                if (hasDetailedData) {
                                    console.log('✅ Found detailed opgaver data in history!');
                                    // Transform from detailed old format to new format
                                    const transformedResults = opgaverArray
                                        .filter(student => !student.error)
                                        .map(student => ({
                                            // ✅ Beregn submissionId fra elevNavn/fileName
                                            submissionId: student.submissionId || student.fileName?.replace(/\.[^/.]+$/, '') || student.elevNavn?.replace(/\.[^/.]+$/, '') || 'unknown',
                                            elevNavn: student.elevNavn || 'Ukendt',
                                            fileName: student.fileName || student.elevNavn,
                                            opgaver: student.opgaver || [], // Detailed opgaver array
                                            totalPoint: student.totalPoint || 0,
                                            karakter: student.karakter || 0,
                                            karakterBegrundelse: student.karakterBegrundelse || '',
                                            samletFeedback: student.samletFeedback || '',
                                            // Include teacher grading if available
                                            lærerTotalPoint: student.lærerTotalPoint,
                                            lærerKarakter: student.lærerKarakter,
                                            // Metadata from history
                                            historyId: historyEntry.id
                                        }));
                                    
                                    console.log(`🔄 Transformed ${transformedResults.length} results WITH detailed opgaver from gradingHistory`);
                                    console.log('🔍 First result opgaver:', transformedResults[0]?.opgaver);
                                    grading.setResults(transformedResults);
                                    console.log(`✅ Loaded detailed results from gradingHistory collection`);
                                } else {
                                    console.log('⚠️ Old format without detailed opgaver data');
                                    // Transform old format without details to new format
                                    const transformedResults = opgaverArray
                                        .filter(opgave => !opgave.error)
                                        .map(opgave => ({
                                            elevNavn: opgave.elevNavn || 'Ukendt',
                                            opgaver: [], // Old format doesn't have detailed opgaver
                                            totalPoint: opgave.totalPoint || 0,
                                            karakter: opgave.karakter || 0,
                                            karakterBegrundelse: '',
                                            samletFeedback: '',
                                            // Metadata from history
                                            fromHistory: true,
                                            historyId: historyEntry.id
                                        }));
                                    
                                    console.log(`🔄 Transformed ${transformedResults.length} results from old gradingHistory format (no details)`);
                                    grading.setResults(transformedResults);
                                    console.log(`✅ Loaded results from old gradingHistory collection`);
                                }
                            } else {
                                console.log('ℹ️ No matching history entry found for this exam');
                            }
                        } else {
                            console.log('ℹ️ No entries in gradingHistory collection either');
                        }
                    }
                } catch (err) {
                    console.error('❌ Error loading grading results:', err);
                    console.error('❌ Error stack:', err.stack);
                    grading.setError(`Kunne ikke indlæse rettelser: ${err.message}`);
                }
            } catch (err) {
                console.error('Error loading existing files:', err);
            }
        };
        
        loadExistingFiles();
    }, [exam?.id, examId]); // Only re-run when exam ID changes
    
    /**
     * Handle Rettevejledning upload with database persistence
     */
    const handleRettevejledningUpload = async (event) => {
        const file = event.target.files[0];
        if (!file || !examId) return;
        
        try {
            setUploadStatus('📤 Uploader rettevejledning...');
            
            // Upload to Storage and Firestore
            const uploadResult = await uploadRettevejledning(examId, file);
            
            // Update local state
            grading.setDocuments(prev => ({ ...prev, rettevejledning: file }));
            setUploadedFiles(prev => ({ ...prev, rettevejledning: uploadResult }));
            
            // Update exam context
            await refreshExam();
            
            setUploadStatus('✅ Rettevejledning uploadet!');
            setTimeout(() => setUploadStatus(''), 3000);
        } catch (err) {
            console.error('Error uploading rettevejledning:', err);
            grading.setError(`Fejl ved upload: ${err.message}`);
        }
    };
    
    /**
     * Handle Omsætningstabel upload with database persistence
     */
    const handleOmsaetningstabelUpload = async (event) => {
        const file = event.target.files[0];
        if (!file || !examId) return;
        
        try {
            setUploadStatus('📤 Uploader omsætningstabel...');
            
            // Upload to Storage and Firestore
            const uploadResult = await uploadOmsaetningstabel(examId, file);
            
            // Update local state
            grading.setDocuments(prev => ({ ...prev, omsætningstabel: file }));
            setUploadedFiles(prev => ({ ...prev, omsætningstabel: uploadResult }));
            
            // Update exam context
            await refreshExam();
            
            setUploadStatus('✅ Omsætningstabel uploadet!');
            setTimeout(() => setUploadStatus(''), 3000);
        } catch (err) {
            console.error('Error uploading omsætningstabel:', err);
            grading.setError(`Fejl ved upload: ${err.message}`);
        }
    };
    
    /**
     * Handle student submissions upload with uniqueness validation
     */
    const handleSubmissionsUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0 || !examId) return;
        
        try {
            setUploadStatus('📋 Kontrollerer filer...');
            const duplicates = [];
            const validFiles = [];
            
            // Check each file for uniqueness
            for (const file of files) {
                const exists = await checkFilenameExists(examId, file.name);
                if (exists) {
                    duplicates.push(file.name);
                } else {
                    validFiles.push(file);
                }
            }
            
            setDuplicateFiles(duplicates);
            
            // Upload valid files
            if (validFiles.length > 0) {
                setUploadStatus(`📤 Uploader ${validFiles.length} filer...`);
                
                for (let i = 0; i < validFiles.length; i++) {
                    const file = validFiles[i];
                    setUploadStatus(`📤 Uploader ${i + 1}/${validFiles.length}: ${file.name}...`);
                    
                    try {
                        await uploadSubmission(examId, file);
                        console.log(`✅ Uploaded: ${file.name}`);
                    } catch (err) {
                        console.error(`❌ Failed to upload ${file.name}:`, err);
                    }
                }
                
                // Update local state with all files (for grading)
                grading.setDocuments(prev => ({ 
                    ...prev, 
                    elevbesvarelser: [...prev.elevbesvarelser, ...validFiles] 
                }));
                
                setUploadStatus(`✅ ${validFiles.length} filer uploadet!`);
                setTimeout(() => setUploadStatus(''), 3000);
            }
            
            if (duplicates.length > 0) {
                grading.setError(`⚠️ ${duplicates.length} filer sprunget over (allerede uploaded): ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`);
            }
        } catch (err) {
            console.error('Error uploading submissions:', err);
            grading.setError(`Fejl ved upload: ${err.message}`);
        }
    };
    
    /**
     * Delete all grading results
     */
    const handleDeleteAllGradings = async () => {
        if (!examId) return;
        
        const confirmed = window.confirm(
            `Er du sikker på at du vil slette ALLE rettelser for denne eksamen?\n\n` +
            `Dette vil slette ${grading.results.length} rettelser og kan ikke fortrydes!`
        );
        
        if (!confirmed) return;
        
        try {
            setUploadStatus('🗑️ Sletter rettelser...');
            
            // Delete all grading results from database
            const deletedCount = await deleteAllGradingResults(examId);
            
            // Clear local results
            grading.setResults([]);
            
            // Refresh exam context
            await refreshExam();
            
            setUploadStatus(`✅ ${deletedCount} rettelser slettet!`);
            setTimeout(() => setUploadStatus(''), 3000);
        } catch (err) {
            console.error('Error deleting gradings:', err);
            grading.setError(`Fejl ved sletning: ${err.message}`);
        }
    };
    
    /**
     * Grade Dansk exams using dynamic bedømmelseskema
     */
    const handleGradeDanskExams = async () => {
        if (!parsedBedoemmelse) {
            grading.setError('Bedømmelseskema ikke parsed endnu. Upload bedømmelseskema først.');
            return;
        }
        
        if (grading.documents.elevbesvarelser.length === 0) {
            grading.setError('Upload elevbesvarelser først');
            return;
        }
        
        setDanskGrading(true);
        grading.setError(null);
        
        const existingResults = [...grading.results];
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
                    
                    // Wait between requests
                    if (i < grading.documents.elevbesvarelser.length - 1) {
                        for (let j = 5; j > 0; j--) {
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
            
        } catch (err) {
            grading.setError(err.message);
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
        const gradedSubmissions = grading.results.length;
        
        if (gradedSubmissions >= totalSubmissions) {
            grading.setError('⚠️ Alle besvarelser er allerede rettet. Slet rettelserne først hvis du vil rette igen.');
            return;
        }
        
        // Store the count of results before grading
        const resultsBeforeGrading = grading.results.length;
        
        // Branch based on exam type
        if (exam?.type === 'Dansk') {
            // DANSK GRADING FLOW
            await handleGradeDanskExams();
        } else {
            // MATEMATIK GRADING FLOW (original logic)
            if (!grading.canProceed()) {
                grading.setError('Upload alle nødvendige dokumenter');
                return;
            }
            await grading.gradeAllExams();
        }
        
        // After grading completes, save ONLY NEW results to database
        const allResults = grading.results;
        const newResults = allResults.slice(resultsBeforeGrading); // Only the newly graded ones
        
        if (newResults.length > 0) {
            try {
                console.warn('🚨🚨🚨 SIMON TEST: SAVING RESULTS STARTED 🚨🚨🚨');
                console.warn('🚨 Number of new results to save:', newResults.length);
                console.warn('🚨 Exam type:', exam?.type);
                console.warn('🚨 First result:', newResults[0]);
                
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
                            console.log('🔍 DEBUG: Preparing Dansk gradingData for submission:', submissionId);
                            console.log('🔍 DEBUG: result.dele:', result.dele);
                            console.log('🔍 DEBUG: result.dele length:', result.dele?.length);
                            console.log('🔍 DEBUG: result.samletKarakter:', result.samletKarakter);
                            console.log('🔍 DEBUG: result.afrundetKarakter:', result.afrundetKarakter);
                            
                            gradingData = {
                                submissionId: submissionId,
                                elevNavn: result.elevNavn,
                                fileName: result.fileName,
                                dele: result.dele || [],
                                samletKarakter: result.samletKarakter || 0,
                                afrundetKarakter: result.afrundetKarakter || 0,
                                karakterBegrundelse: result.karakterBegrundelse || '',
                                aiProvider: 'openai',
                                aiModel: 'gpt-4o',
                                apiCost: danskTotalCost / newResults.filter(r => !r.error).length || 0,
                                processingTimeMs: 0
                            };
                            
                            console.log('🔍 DEBUG: Final gradingData.dele:', gradingData.dele);
                            console.log('🔍 DEBUG: Final gradingData structure:', JSON.stringify(gradingData, null, 2));
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
                                aiProvider: 'openai',
                                aiModel: 'gpt-4o',
                                apiCost: grading.totalCost / newResults.filter(r => !r.error).length || 0,
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
                        
                        // ✅ ONLY save NEW results to gradingHistory collection (not all results)
                        console.log('💾 Also saving NEW results to gradingHistory for logging...');
                        try {
                            const totalCostToSave = exam?.type === 'Dansk' ? danskTotalCost : grading.totalCost;
                            await firestore.saveToHistory(newResults, totalCostToSave);
                            console.log(`✅ Saved ${newResults.length} NEW results to gradingHistory collection`);
                        } catch (historyErr) {
                            console.error('⚠️ Could not save to gradingHistory:', historyErr);
                            // Don't fail the whole operation if history save fails
                        }
                        
                        setUploadStatus(`✅ ${savedCount} nye resultater gemt! (Total: ${allResults.length})${errorCount > 0 ? ` (${errorCount} fejl)` : ''}`);
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
    
    /**
     * Replace existing file (for rettevejledning/omsætningstabel)
     */
    const handleReplaceFile = (type) => {
        grading.setDocuments(prev => ({ ...prev, [type]: null }));
        setUploadedFiles(prev => ({ ...prev, [type]: null }));
    };

    /**
     * Delete a submission file
     */
    const handleDeleteSubmission = (idx) => {
        const newFiles = grading.documents.elevbesvarelser.filter((_, i) => i !== idx);
        grading.setDocuments(prev => ({ ...prev, elevbesvarelser: newFiles }));
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-6xl mx-auto">
                {/* Combined compact header block */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    {/* Exam Header Row - Compact */}
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center gap-6">
                            {/* Exam Number/Title */}
                            <h1 className="text-3xl font-bold text-gray-800">
                                {exam?.beskrivelse || 'Prøve'}
                            </h1>
                            
                            {/* Metadata */}
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    <span>Dato:</span>
                                    <span className="font-medium">{formatDate(exam?.dato)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    <span>Klasse:</span>
                                    <span className="font-medium">{exam?.klasse || '-'}</span>
                                </div>
                            </div>
                        </div>
                        
                        {/* Type Badge */}
                        <span className={`px-4 py-2 rounded-full text-sm font-semibold border ${getTypeBadgeColor(exam?.type)}`}>
                            {exam?.type || 'Ukendt'}
                        </span>
                    </div>
                    
                    {/* Upload status */}
                    {uploadStatus && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                            <p className="text-sm text-blue-800 font-medium">{uploadStatus}</p>
                            {uploading && uploadProgress > 0 && (
                                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Error Display */}
                    {(grading.error || uploadError) && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold text-red-800 text-sm">Fejl</p>
                                <p className="text-red-700 text-sm">{grading.error || uploadError}</p>
                            </div>
                        </div>
                    )}

                    {/* Files & Action buttons row */}
                    <div className="flex items-center justify-between mb-4">
                        {/* File Links */}
                        <div className="flex items-center gap-3 text-sm">
                            {/* Matematik: Rettevejledning */}
                            {exam?.type === 'Matematik' && exam?.rettevejledningRef && (
                                <a
                                    href="#"
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        const url = await getFileDownloadURL(exam.rettevejledningRef.storagePath);
                                        window.open(url, '_blank');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>Rettevejledning</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                            {/* Matematik: Omsætningstabel */}
                            {exam?.type === 'Matematik' && exam?.omsætningstabelRef && (
                                <a
                                    href="#"
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        const url = await getFileDownloadURL(exam.omsætningstabelRef.storagePath);
                                        window.open(url, '_blank');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>Omsætningstabel</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                            {/* Dansk: Bedømmelseskema */}
                            {exam?.type === 'Dansk' && exam?.bedoemmelseskemaRef && (
                                <a
                                    href="#"
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        const url = await getFileDownloadURL(exam.bedoemmelseskemaRef.storagePath);
                                        window.open(url, '_blank');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-colors"
                                >
                                    <FileText className="w-4 h-4" />
                                    <span>Bedømmelseskema</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                            {(grading.totalCost > 0 || danskTotalCost > 0) && (
                                <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700">
                                    💰 ${((exam?.type === 'Dansk' ? danskTotalCost : grading.totalCost) || 0).toFixed(4)} (ca. {(((exam?.type === 'Dansk' ? danskTotalCost : grading.totalCost) || 0) * 7).toFixed(2)} kr)
                                </div>
                            )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-3">
                            {/* Ret opgaver button */}
                            <button
                                onClick={handleGradeAllExams}
                                disabled={
                                    (exam?.type === 'Matematik' && !grading.canProceed()) ||
                                    (exam?.type === 'Dansk' && (!parsedBedoemmelse || grading.documents.elevbesvarelser.length === 0)) ||
                                    grading.grading ||
                                    danskGrading ||
                                    !examId ||
                                    grading.results.length >= grading.documents.elevbesvarelser.length
                                }
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white disabled:text-gray-500 font-semibold rounded-lg transition-all flex items-center gap-2 text-sm shadow-md"
                                title={grading.results.length >= grading.documents.elevbesvarelser.length ? "Alle besvarelser er allerede rettet" : ""}
                            >
                                {(grading.grading || danskGrading) ? (
                                    <>
                                        <Loader2 />
                                        Retter {grading.results.length}/{grading.documents.elevbesvarelser.length}
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="w-4 h-4" />
                                        {grading.results.length > 0
                                            ? `Rettet (${grading.results.length}/${grading.documents.elevbesvarelser.length})`
                                            : `Ret ${grading.documents.elevbesvarelser.length - grading.results.length} af ${grading.documents.elevbesvarelser.length}`
                                        }
                                    </>
                                )}
                            </button>
                            
                            {/* Log button */}
                            <button
                                onClick={() => setShowLogPanel(!showLogPanel)}
                                className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-md transition-all"
                            >
                                <Database className="w-4 h-4" />
                                Log ({firestore.gradingHistory.length})
                            </button>
                        </div>
                    </div>
                    
                    {/* Grading Progress */}
                    {(grading.grading || danskGrading) && (grading.statusMessage || danskStatusMessage) && (
                        <div className="mb-4">
                            <GradingProgress
                                statusMessage={danskGrading ? danskStatusMessage : grading.statusMessage}
                                currentTaskPhase={danskGrading ? danskCurrentTaskPhase : grading.currentTaskPhase}
                                completedCount={grading.results.length}
                                totalCount={grading.documents.elevbesvarelser.length}
                                retryInfo={grading.retryInfo}
                                requestDebugInfo={null}
                                currentFileName={grading.documents.elevbesvarelser[grading.results.length]?.name || ''}
                            />
                        </div>
                    )}
                    
                    {/* Compact Existing Results Info + Overview */}
                    {grading.results.length > 0 && !grading.results[0]?.fromHistory && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                            {/* Header row */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-blue-600" />
                                    <h3 className="font-bold text-blue-900 text-base">
                                        📊 Eksisterende rettelser ({grading.results.length})
                                    </h3>
                                </div>
                                <p className="text-blue-700 text-xs">
                                    {exam?.type === 'Matematik' ? (
                                        <>
                                            Gennemsnit: {(grading.results.reduce((sum, r) => sum + (r.totalPoint || 0), 0) / grading.results.length).toFixed(1)} point
                                            {' • '}
                                        </>
                                    ) : null}
                                    Karakter: {(grading.results.reduce((sum, r) => sum + ((r.afrundetKarakter ?? r.karakter) || 0), 0) / grading.results.length).toFixed(1)}
                                </p>
                            </div>
                            
                            {/* Compact Overview Stats */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                                    <p className="text-xs text-gray-600 mb-1">Antal prøver</p>
                                    <p className="text-2xl font-bold text-blue-600">{grading.results.length}</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 text-center border border-green-100">
                                    <p className="text-xs text-gray-600 mb-1">Gns. karakter</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {(grading.results.reduce((sum, r) => sum + ((r.afrundetKarakter ?? r.karakter) || 0), 0) / grading.results.length).toFixed(1)}
                                    </p>
                                </div>
                                {exam?.type === 'Matematik' ? (
                                    <>
                                        <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                                            <p className="text-xs text-gray-600 mb-1">Gns. point</p>
                                            <p className="text-2xl font-bold text-purple-600">
                                                {Math.round(grading.results.reduce((sum, r) => sum + (r.totalPoint || 0), 0) / grading.results.length)}
                                            </p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 text-center border border-amber-100">
                                            <p className="text-xs text-gray-600 mb-1">Højeste point</p>
                                            <p className="text-2xl font-bold text-amber-600">
                                                {Math.max(...grading.results.map(r => r.totalPoint || 0))}
                                            </p>
                                        </div>
                                    </>
                                ) : exam?.type === 'Dansk' ? (
                                    <>
                                        <div className="bg-white rounded-lg p-3 text-center border border-purple-100">
                                            <p className="text-xs text-gray-600 mb-1">Gns. beregnet</p>
                                            <p className="text-2xl font-bold text-purple-600">
                                                {(grading.results.reduce((sum, r) => sum + (r.samletKarakter || 0), 0) / grading.results.length).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 text-center border border-amber-100">
                                            <p className="text-xs text-gray-600 mb-1">Højeste</p>
                                            <p className="text-2xl font-bold text-amber-600">
                                                {Math.max(...grading.results.map(r => r.afrundetKarakter || r.karakter || 0))}
                                            </p>
                                        </div>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
                {showLogPanel && (
                    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                        <AdminPanel
                            gradingHistory={firestore.gradingHistory}
                            loadingHistory={firestore.loadingHistory}
                            onDeleteEntry={firestore.deleteHistoryEntry}
                            onClearAll={firestore.clearAllHistory}
                            onEstimatePrices={firestore.estimateAllMissingPrices}
                            examId={examId}
                        />
                    </div>
                )}

                {/* Results */}
                {grading.results.length > 0 && (
                    <div className="space-y-6">
                        {/* Check if results are from old format (missing detailed opgaver data) */}
                        {grading.results[0]?.fromHistory ? (
                            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-6">
                                <div className="flex items-start gap-3">
                                    <span className="text-3xl">⚠️</span>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-amber-900 text-lg mb-2">
                                            Gamle rettelser fundet
                                        </h3>
                                        <p className="text-amber-800 mb-4">
                                            Disse rettelser er gemt i det gamle format og indeholder kun oversigtsdata (karakter og point).
                                            For at se detaljerede resultater med feedback til hver opgave, skal du rette de igen.
                                        </p>
                                        
                                        <div className="bg-white/70 rounded-lg p-4 mb-4">
                                            <h4 className="font-semibold text-amber-900 mb-3">Rettede elever:</h4>
                                            <div className="grid gap-2">
                                                {grading.results.map((result, idx) => (
                                                    <div key={idx} className="flex items-center justify-between p-3 bg-amber-100/50 rounded border border-amber-200">
                                                        <span className="font-medium text-amber-900">{result.elevNavn}</span>
                                                        <div className="flex items-center gap-4 text-sm">
                                                            <span className="text-amber-700">Point: <strong>{result.totalPoint}</strong></span>
                                                            <span className="px-3 py-1 bg-green-600 text-white rounded-full font-bold">
                                                                {result.karakter}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <p className="text-sm text-amber-700 mb-3">
                                            <strong>Note:</strong> Slet disse gamle rettelser og ret opgaverne igen for at få fuld detalje-visning.
                                        </p>
                                        
                                        <button
                                            onClick={() => {
                                                if (window.confirm('Denne handling kan ikke fortrydes. Ønsker du at fortsætte?')) {
                                                    handleDeleteAllGradings();
                                                }
                                            }}
                                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Slet gamle rettelser
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {grading.results.map((result, idx) => {
                                    // Betinget rendering baseret på exam type
                                    if (exam?.type === 'Dansk') {
                                        return (
                                            <DanskStudentResult
                                                key={idx}
                                                result={result}
                                                index={idx}
                                                parsedBedoemmelse={parsedBedoemmelse}
                                                examId={examId}
                                                onSave={(idx, lærerGrading) => {
                                                    // Update result with lærer grading
                                                    grading.setResults(prev => {
                                                        const updated = [...prev];
                                                        updated[idx] = {
                                                            ...updated[idx],
                                                            lærerGrading
                                                        };
                                                        return updated;
                                                    });
                                                }}
                                            />
                                        );
                                    } else {
                                        // Matematik (original)
                                        return (
                                            <StudentResult
                                                key={idx}
                                                result={result}
                                                index={idx}
                                                editMode={grading.editMode[idx] || false}
                                                tempPoints={grading.tempLærerPoints}
                                                detailedFeedback={grading.detailedFeedback}
                                                loadingDetailedFeedback={grading.loadingDetailedFeedback}
                                                onStartEdit={() => grading.startEditing(idx)}
                                                onSaveEdit={() => grading.saveLærerGrading(idx)}
                                                onCancelEdit={() => grading.cancelEditing(idx)}
                                                onUpdatePoint={grading.updateTempLærerPoint}
                                                onAskAIDetails={grading.askAIForDetails}
                                                examId={examId}
                                            />
                                        );
                                    }
                                })}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

import { useState } from 'react';
import { updateTeacherGrading, recalculateExamStats } from '../services/firestoreService.js';

export function useGradingLogic(readFileContent, examId = null) {
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

    const apiProvider = 'openai';

    const testConnection = async () => {
        setTestingConnection(true);
        setConnectionTestResult(null);
        setError(null);
        try {
            const response = await fetch('/.netlify/functions/grade-exam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt: "Test", userPrompt: "Sig hej", apiProvider: 'openai' })
            });
            if (!response.ok) throw new Error(`API fejl: ${response.status}`);
            const data = await response.json();
            if (data.success) {
                setConnectionTestResult({ success: true, message: 'Forbindelse succesfuld!', provider: 'OpenAI', model: 'gpt-4o' });
            } else {
                throw new Error(data.error || 'Ukendt fejl');
            }
        } catch (err) {
            setConnectionTestResult({ success: false, message: err.message });
        } finally {
            setTestingConnection(false);
        }
    };

    const callAI = async (rettevejledning, omsætningstabel, elevbesvarelse, elevNavn, submissionId, maxRetries = 5) => {
        const systemPrompt = `Du er en erfaren matematikvejleder der retter FP10 matematik prøver.

Din opgave:
1. Analysere elevens besvarelse
2. Tildele point NØJAGTIGT efter rettevejledning
3. Give konstruktiv feedback (MAX 1-2 sætninger per opgave)
4. Beregne totalPoint som SUM af alle givetPoint
5. Konvertere til karakter efter omsætningstabel

KRITISK REGLER:
- Brug PRÆCIS det elevnavn der står i prompten: "${elevNavn}"
- ALDRIG brug andre navne du finder i besvarelsen
- For hver opgave skal du inkludere 'maxPoint' baseret på rettevejledningen
- Hold feedback KORT og præcis (undgå lange forklaringer)
- ALTID returner KOMPLET og VALID JSON

Returner JSON med:
- elevNavn (string - SKAL være "${elevNavn}")
- opgaver[] (array hvor hvert element har: nummer, elevSvar, korrektSvar, givetPoint, maxPoint, feedback)
- totalPoint (number - sum af alle givetPoint)
- karakter (number)
- karakterBegrundelse (string - max 100 ord)
- samletFeedback (string - max 200 ord)`;

        const userPrompt = `RETTEVEJLEDNING:\n${rettevejledning}\n\nOMSÆTNINGSTABEL:\n${omsætningstabel}\n\nELEVNAVN (SKAL bruges i JSON): ${elevNavn}\n\nELEVBESVARELSE:\n${elevbesvarelse}\n\nRet nu elevbesvarelsen.`;

        const debugInfo = {
            endpoint: '/.netlify/functions/grade-exam',
            systemPromptSize: `${(systemPrompt.length / 1024).toFixed(2)} KB`,
            userPromptSize: `${(userPrompt.length / 1024).toFixed(2)} KB`,
            rettevejledningSize: `${(rettevejledning.length / 1024).toFixed(2)} KB`,
            omsætningstabelSize: `${(omsætningstabel.length / 1024).toFixed(2)} KB`,
            elevbesvarelseSize: `${(elevbesvarelse.length / 1024).toFixed(2)} KB`
        };
        setRequestDebugInfo(debugInfo);

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                setCurrentTaskPhase('Sender anmodning til AI...');
                setStatusMessage(`📤 Sender anmodning for ${elevNavn}...`);
                
                // Create AbortController for client-side timeout (29s to stay under function's 30s limit)
                const controller = new AbortController();
                const clientTimeout = setTimeout(() => {
                    controller.abort();
                }, 29000);  // 29 seconds
                
                let response;
                try {
                    response = await fetch('/.netlify/functions/grade-exam', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ systemPrompt, userPrompt, apiProvider }),
                        signal: controller.signal
                    });
                    
                    clearTimeout(clientTimeout);

                    if (!response.ok) {
                        const errorData = await response.text();
                        if (response.status === 429) {
                            const waitTime = Math.min(60 * Math.pow(2, attempt), 300);
                            setRetryInfo({ attempt: attempt + 1, maxRetries, waitTime, elevNavn });
                            for (let i = waitTime; i > 0; i--) {
                                setStatusMessage(`⏳ Venter ${i} sekunder...`);
                                await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                            setRetryInfo(null);
                            continue;
                        }
                        if (response.status === 502) {
                            throw new Error(`Timeout: Dokumentet er for langt eller komplekst. Prøv at opdele i mindre dele.`);
                        }
                        throw new Error(`API fejl: ${response.status} - ${errorData}`);
                    }
                } catch (fetchError) {
                    clearTimeout(clientTimeout);
                    if (fetchError.name === 'AbortError') {
                        throw new Error(`Timeout: Dokumentet tog for lang tid at rette. Prøv et kortere dokument.`);
                    }
                    throw fetchError;
                }

                const responseData = await response.json();
                if (!responseData.success) throw new Error(responseData.error || 'Unknown error');
                
                const data = responseData.data;
                const content = data.choices[0].message.content;
                
                if (data.usage) {
                    const cost = (data.usage.prompt_tokens / 1000000) * 2.50 + (data.usage.completion_tokens / 1000000) * 10.00;
                    setTotalCost(prev => prev + cost);
                    console.log(`💰 Cost: $${cost.toFixed(4)}`);
                }
                
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const jsonText = jsonMatch[0];
                    
                    // ✅ VALIDERING: Check om JSON er komplet
                    if (!jsonText.trim().endsWith('}')) {
                        throw new Error('Ufuldstændig JSON - AI svar blev sandsynligvis trunkeret. Dokumentet er for langt.');
                    }
                    
                    // ✅ Check påkrævede felter
                    const requiredFields = ['elevNavn', 'opgaver', 'totalPoint', 'karakter'];
                    const missingFields = requiredFields.filter(field => !jsonText.includes(`"${field}"`));
                    if (missingFields.length > 0) {
                        throw new Error(`Manglende påkrævede felter i JSON: ${missingFields.join(', ')}`);
                    }
                    
                    let result;
                    try {
                        result = JSON.parse(jsonText);
                    } catch (parseError) {
                        console.error('❌ JSON parse error:', parseError);
                        console.error('❌ Trying to parse:', jsonText.substring(0, 500));
                        
                        // Try to fix common JSON errors
                        let fixedJson = jsonText;
                        
                        // Fix trailing commas before closing brackets
                        fixedJson = fixedJson.replace(/,(\s*[\]}])/g, '$1');
                        
                        // Try parsing again
                        try {
                            result = JSON.parse(fixedJson);
                            console.log('✅ Fixed JSON and parsed successfully');
                        } catch (retryError) {
                            console.error('❌ Could not parse even after fix attempt');
                            throw new Error(`JSON parse fejl: ${parseError.message}. AI svar var ugyldigt formateret.`);
                        }
                    }
                    
                    // ✅ FORCER korrekt elevNavn (fra parameter, ikke fra AI)
                    if (result.elevNavn !== elevNavn) {
                        console.warn(`⚠️ AI returnerede forkert navn: "${result.elevNavn}" → korrigerer til "${elevNavn}"`);
                        result.elevNavn = elevNavn;
                    }
                    
                    // ✅ TILFØJ submissionId og fileName
                    result.submissionId = submissionId;
                    result.fileName = elevNavn;
                    
                    // Validation
                    if (result.opgaver && Array.isArray(result.opgaver)) {
                        const calculatedTotal = result.opgaver.reduce((sum, opgave) => sum + (opgave.givetPoint || 0), 0);
                        if (result.totalPoint !== calculatedTotal) {
                            console.warn(`⚠️ Auto-correct: ${result.totalPoint} → ${calculatedTotal}`);
                            result.totalPoint = calculatedTotal;
                        }
                    }
                    return result;
                }
                throw new Error('Kunne ikke finde JSON i AI svar');
            } catch (err) {
                if (attempt === maxRetries - 1) throw err;
                if (err.message.includes('429')) {
                    const waitTime = Math.min(60 * Math.pow(2, attempt), 300);
                    for (let i = waitTime; i > 0; i--) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } else {
                    throw err;
                }
            }
        }
        throw new Error('Max forsøg nået');
    };

    const gradeAllExams = async () => {
        if (!documents.rettevejledning || !documents.omsætningstabel || documents.elevbesvarelser.length === 0) {
            setError('Upload venligst alle nødvendige dokumenter');
            return [];
        }

        setGrading(true);
        setError(null);
        
        // Don't clear existing results! Keep them and only add new ones
        const existingResults = [...results];
        const newGradingCost = 0;

        try {
            const rettevejledning = await readFileContent(documents.rettevejledning);
            const omsætningstabel = await readFileContent(documents.omsætningstabel);
            
            // ✅ Use submissionId for skip check (NOT elevNavn)
            const gradedSubmissionIds = new Set(
                existingResults.map(r => r.submissionId || r.fileName?.replace(/\.[^/.]+$/, '') || r.elevNavn.replace(/\.[^/.]+$/, ''))
            );
            const newlyGradedResults = [];
            
            console.log(`📊 Already graded submission IDs:`, Array.from(gradedSubmissionIds));
            console.log(`📊 Total submissions:`, documents.elevbesvarelser.length);

            for (let i = 0; i < documents.elevbesvarelser.length; i++) {
                const elevFile = documents.elevbesvarelser[i];
                
                // ✅ KORREKT: Beregn submissionId fra filnavn
                const submissionId = elevFile.name.replace(/\.[^/.]+$/, '');
                
                // ✅ KORREKT: Match på submissionId
                if (gradedSubmissionIds.has(submissionId)) {
                    console.log(`⏭️ Skipping ${submissionId} (${elevFile.name}) - already graded`);
                    setStatusMessage(`⏭️ Springer ${submissionId} over - allerede rettet (${i + 1}/${documents.elevbesvarelser.length})`);
                    continue;
                }
                
                try {
                    setStatusMessage(`📖 Læser ${elevFile.name} (${i + 1}/${documents.elevbesvarelser.length})...`);
                    const elevbesvarelse = await readFileContent(elevFile);
                    
                    // ✅ Send både filnavn OG submissionId
                    const result = await callAI(rettevejledning, omsætningstabel, elevbesvarelse, elevFile.name, submissionId);
                    newlyGradedResults.push(result);
                    
                    // Update results incrementally with existing + new results
                    setResults([...existingResults, ...newlyGradedResults]);
                    
                    if (i < documents.elevbesvarelser.length - 1) {
                        for (let j = 5; j > 0; j--) {
                            setStatusMessage(`⏸️ Venter ${j} sekunder...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                } catch (err) {
                    console.error(`Fejl: ${elevFile.name}`, err);
                    // ✅ Inkluder submissionId også ved fejl
                    newlyGradedResults.push({
                        submissionId: submissionId,
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
            
            // ✅ Return newly graded results
            return newlyGradedResults;
        } catch (err) {
            setError(err.message);
            return [];
        } finally {
            setGrading(false);
        }
    };

    const askAIForDetails = async (resultIdx, opgaveIdx, customQuestion = null, imageBase64 = null, clearOnly = false) => {
        const key = `${resultIdx}-${opgaveIdx}`;
        
        // If clearOnly is true, just clear the feedback and return
        if (clearOnly) {
            setDetailedFeedback(prev => {
                const newFeedback = { ...prev };
                delete newFeedback[key];
                return newFeedback;
            });
            return;
        }
        
        const result = results[resultIdx];
        const opgave = result.opgaver[opgaveIdx];
        
        // Don't prevent asking if there's a custom question
        if (!customQuestion && detailedFeedback[key]?.text) return;
        
        setLoadingDetailedFeedback(key);
        
        console.log('🔍 DEBUG: askAIForDetails called');
        console.log('  - customQuestion:', customQuestion);
        console.log('  - hasImage:', !!imageBase64);
        if (imageBase64) {
            console.log('  - imageBase64 length:', imageBase64.length);
            console.log('  - imageBase64 starts with:', imageBase64.substring(0, 50));
        }
        
        try {
            let systemPrompt, userPrompt;
            
            if (customQuestion) {
                // Custom question mode - read entire document and answer specific question
                systemPrompt = `Du er en erfaren matematikvejleder.
                
Læreren har stillet et specifikt spørgsmål om en elevs besvarelse af opgave ${opgave.nummer}.${imageBase64 ? ' Læreren har også vedhæftet et screenshot for at vise præcis hvad de refererer til.' : ''}

Din opgave er at:
1. Læse HELE elevens dokument gr undigt (ikke kun det der blev ekstraheret som svar)
2. ${imageBase64 ? 'Analysere det vedhæftede screenshot/billede læreren har sendt' : ''}
3. Svare SPECIFIKT på lærerens spørgsmål
4. Referere til konkret indhold fra elevens dokument${imageBase64 ? ' og det vedhæftede billede' : ''} i dit svar
5. Være særligt opmærksom på om der er billeder, tegninger eller andet indhold der måske ikke blev fanget korrekt

${imageBase64 ? 'Brug det vedhæftede screenshot til at forstå præcis hvad læreren refererer til.' : 'Hvis eleven har indsat billeder eller tegninger som du ikke kan se direkte, skal du nævne det i dit svar.'}`;

                // Get the full student document
                console.log('🔍 Looking for student file...');
                console.log('  - result.submissionId:', result.submissionId);
                console.log('  - result.fileName:', result.fileName);
                console.log('  - result.elevNavn:', result.elevNavn);
                console.log('  - Available files:', documents.elevbesvarelser.map(f => f.name));
                
                const elevFile = documents.elevbesvarelser.find(f =>
                    (result.submissionId && f.name.replace(/\.[^/.]+$/, '') === result.submissionId) ||
                    (result.fileName && f.name === result.fileName) ||
                    f.name === result.elevNavn
                );
                
                console.log('  - Found elevFile:', elevFile?.name);
                
                let fullDocument = 'Kunne ikke finde det fulde dokument.';
                if (elevFile) {
                    try {
                        fullDocument = await readFileContent(elevFile);
                        console.log('📄 Full document length:', fullDocument.length);
                        console.log('📄 Document preview:', fullDocument.substring(0, 500));
                    } catch (err) {
                        console.error('Could not read full document:', err);
                        fullDocument = `Fejl ved læsning af dokument: ${err.message}`;
                    }
                } else {
                    console.error('❌ Could not find student file!');
                }

                userPrompt = `HELE ELEVENS DOKUMENT:
${fullDocument}

SPECIFIK OPGAVE DER SPØRGES TIL (Opgave ${opgave.nummer}):
- Givet point: ${opgave.givetPoint}/${opgave.maxPoint}
- Elevens svar (ekstraheret): ${opgave.elevSvar || 'Ikke ekstraheret korrekt'}
- Korrekt svar: ${opgave.korrektSvar}
- Feedback: ${opgave.feedback}

LÆRERENS SPØRGSMÅL:
${customQuestion}

${imageBase64 ? 'VEDHÆFTET SCREENSHOT: Se billedet nedenfor for præcis kontekst.' : ''}

Besvar lærerens spørgsmål grundigt baseret på hele dokumentet${imageBase64 ? ' og det vedhæftede screenshot' : ''}.`;
            } else {
                // Default question mode - simple explanation
                systemPrompt = 'Du er matematikvejleder. Forklar SPECIFIKT hvad der mangler i elevens svar.';
                userPrompt = `Opgave ${opgave.nummer}: Eleven fik ${opgave.givetPoint}/${opgave.maxPoint} point.\n\nELEVENS SVAR:\n${opgave.elevSvar || 'Ikke besvaret'}\n\nKORREKT SVAR:\n${opgave.korrektSvar}\n\nForklar hvad der mangler.`;
            }
            
            // Prepare request body - with or without image
            const requestBody = imageBase64
                ? { systemPrompt, userPrompt, apiProvider: 'openai', imageBase64 }
                : { systemPrompt, userPrompt, apiProvider: 'openai' };
            
            const response = await fetch('/.netlify/functions/grade-exam', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) throw new Error(`API fejl: ${response.status}`);
            const responseData = await response.json();
            if (!responseData.success) throw new Error(responseData.error);
            
            const content = responseData.data.choices[0].message.content;
            setDetailedFeedback(prev => ({
                ...prev,
                [key]: {
                    loading: false,
                    text: content.trim(),
                    customQuestion: customQuestion || null
                }
            }));
            
            if (responseData.data.usage) {
                const cost = (responseData.data.usage.prompt_tokens / 1000000) * 2.50 + (responseData.data.usage.completion_tokens / 1000000) * 10.00;
                setTotalCost(prev => prev + cost);
            }
        } catch (err) {
            setDetailedFeedback(prev => ({
                ...prev,
                [key]: {
                    loading: false,
                    text: `Fejl: ${err.message}`,
                    error: true,
                    customQuestion: customQuestion || null
                }
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
            // If teacher has already graded, use lærerPoint, otherwise default to AI's givetPoint
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
        try {
            const result = results[resultIdx];
            let lærerTotalPoint = 0;
            
            // Update opgaver with teacher points
            const updatedOpgaver = result.opgaver.map((opgave, opIdx) => {
                const key = `${resultIdx}-${opIdx}`;
                // Priority: 1) tempPoint (if just edited), 2) existing lærerPoint (if previously saved), 3) AI's givetPoint (default)
                const lærerPoint = tempLærerPoints[key] !== undefined
                    ? tempLærerPoints[key]
                    : (opgave.lærerPoint !== undefined ? opgave.lærerPoint : opgave.givetPoint);
                console.log(`Opgave ${opIdx}: tempPoint=${tempLærerPoints[key]}, lærerPoint=${lærerPoint}, existing=${opgave.lærerPoint}, givetPoint=${opgave.givetPoint}`);
                lærerTotalPoint += lærerPoint;
                return {
                    ...opgave,
                    lærerPoint
                };
            });
            
            console.log(`📊 Total lærer points calculated: ${lærerTotalPoint}`);

            // Calculate teacher's grade
            const omsætningstabelContent = await readFileContent(documents.omsætningstabel);
            console.log('🔍 Omsætningstabel content:', omsætningstabelContent.substring(0, 500));
            console.log('🔍 Looking for grade for', lærerTotalPoint, 'points');
            
            let lærerKarakter = -3;
            
            // Try to parse as space/tab separated on single line (from PDF extraction)
            // Format: "Karakter Point - 3 0 0 0 1 12 2 13 20 4 21 36 7 37 51 10 52 64 12 65 75"
            const cleanContent = omsætningstabelContent.replace(/\s+/g, ' ').trim();
            
            // Extract all numbers after "Karakter" and "Point" headers
            const afterHeaders = cleanContent.split(/Karakter.*?Point/i).pop() || cleanContent;
            const numbers = afterHeaders.match(/\-?\d+/g);
            
            if (numbers && numbers.length >= 3) {
                console.log('📊 Found numbers:', numbers);
                // Numbers come in groups of 3: [grade, minPoint, maxPoint]
                for (let i = 0; i < numbers.length - 2; i += 3) {
                    const grade = parseInt(numbers[i]);
                    const min = parseInt(numbers[i + 1]);
                    const max = parseInt(numbers[i + 2]);
                    console.log(`   Range: ${min}-${max} points = grade ${grade}`);
                    
                    if (lærerTotalPoint >= min && lærerTotalPoint <= max) {
                        lærerKarakter = grade;
                        console.log(`✅ Match! ${lærerTotalPoint} points = grade ${lærerKarakter}`);
                        break;
                    }
                }
            } else {
                // Fallback: Try line-by-line parsing for other formats
                const lines = omsætningstabelContent.split('\n');
                for (const line of lines) {
                    // Pattern: "7    37    51" or "7\t37\t51"
                    const match = line.match(/^(\-?\d+)\s+(\d+)\s+(\d+)/);
                    if (match) {
                        const grade = parseInt(match[1]);
                        const min = parseInt(match[2]);
                        const max = parseInt(match[3]);
                        console.log(`   Found range: ${min}-${max} = grade ${grade}`);
                        if (lærerTotalPoint >= min && lærerTotalPoint <= max) {
                            lærerKarakter = grade;
                            console.log(`✅ Match! ${lærerTotalPoint} points = grade ${lærerKarakter}`);
                            break;
                        }
                    }
                }
            }
            
            console.log(`📊 Final grade: ${lærerKarakter} for ${lærerTotalPoint} points`);
            
            if (lærerKarakter === -3) {
                console.error('❌ FEJL: Kunne ikke finde karakter i omsætningstabellen!');
                console.error('📄 Omsætningstabel indhold:', omsætningstabelContent);
                alert(`FEJL: Kunne ikke finde karakter for ${lærerTotalPoint} point i omsætningstabellen.\n\nTjek at omsætningstabellen er korrekt formateret.\n\nSe browser console for detaljer (F12).`);
            }

            // Update local state first
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
            console.log(`✅ Lærer retning: ${lærerTotalPoint} point → karakter ${lærerKarakter}`);
            
            // Save to database if examId is available and result has an id
            if (examId && result.id) {
                try {
                    console.log(`💾 Saving teacher grading to database for result ${result.id}...`);
                    await updateTeacherGrading(examId, result.id, {
                        opgaver: updatedOpgaver,
                        totalPoint: lærerTotalPoint,
                        karakter: lærerKarakter
                    });
                    
                    // Recalculate exam statistics
                    await recalculateExamStats(examId);
                    console.log(`✅ Teacher grading saved to database`);
                } catch (dbError) {
                    console.error('⚠️ Could not save to database:', dbError);
                    // Don't fail the operation if database save fails
                    alert('Rettelsen er gemt lokalt, men kunne ikke gemmes i databasen.');
                }
            } else {
                console.log('ℹ️ No examId or result.id - skipping database save');
            }
        } catch (err) {
            console.error('Fejl ved gemning:', err);
            alert('Kunne ikke beregne karakter. Tjek omsætningstabellen.');
        }
    };

    const cancelEditing = (resultIdx) => {
        setEditMode(prev => ({ ...prev, [resultIdx]: false }));
        const result = results[resultIdx];
        result.opgaver.forEach((_, opIdx) => {
            setTempLærerPoints(prev => {
                const newTemp = { ...prev };
                delete newTemp[`${resultIdx}-${opIdx}`];
                return newTemp;
            });
        });
    };

    const canProceed = () => {
        // Kræver mindst rettevejledning, omsætningstabel og minimum 1 elevbesvarelse
        return documents.rettevejledning && documents.omsætningstabel && documents.elevbesvarelser.length >= 1;
    };

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

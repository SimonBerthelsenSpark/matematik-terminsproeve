import { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, doc, deleteDoc, writeBatch, updateDoc, where } from 'firebase/firestore';

export function useFirestore(db, examId) {
    const [gradingHistory, setGradingHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    useEffect(() => {
        loadHistoryFromFirestore();
    }, [examId]);

    const loadHistoryFromFirestore = async () => {
        try {
            setLoadingHistory(true);
            const historyRef = collection(db, 'gradingHistory');
            
            // Filter by examId if provided
            let q;
            if (examId) {
                q = query(historyRef, where('examId', '==', examId), orderBy('dato', 'desc'));
            } else {
                q = query(historyRef, orderBy('dato', 'desc'));
            }
            
            const snapshot = await getDocs(q);
            const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGradingHistory(history);
            console.log(`📊 Loaded ${history.length} history entries from Firestore${examId ? ` for exam ${examId}` : ''}`);
            
            // Return the loaded history so it can be used immediately
            return history;
        } catch (err) {
            console.error('Kunne ikke indlæse historik fra Firestore:', err);
            const savedHistory = localStorage.getItem('gradingHistory');
            if (savedHistory) {
                try {
                    const parsedHistory = JSON.parse(savedHistory);
                    setGradingHistory(parsedHistory);
                    console.log('📊 Loaded history from localStorage as fallback');
                    return parsedHistory;
                } catch (parseErr) {
                    console.error('Kunne ikke parse localStorage:', parseErr);
                }
            }
            return [];
        } finally {
            setLoadingHistory(false);
        }
    };

    const saveToHistory = async (sessionResults, sessionCost) => {
        try {
            console.log('💾 Preparing to save grading history...');
            console.log('📊 Session results count:', sessionResults.length);
            console.log('📊 First result opgaver:', sessionResults[0]?.opgaver?.length || 0);
            
            const historyEntry = {
                dato: new Date().toISOString(),
                examId: examId || null,
                antalOpgaver: sessionResults.filter(r => !r.error).length,
                opgaver: sessionResults.map(r => {
                    const opgaverData = r.opgaver || [];
                    console.log(`📝 Saving ${r.elevNavn}: ${opgaverData.length} opgaver`);
                    
                    // Ensure each opgave includes lærerPoint if it exists
                    const opgaverWithTeacherPoints = opgaverData.map(opgave => ({
                        ...opgave,
                        // Include lærerPoint if it exists
                        ...(opgave.lærerPoint !== undefined && { lærerPoint: opgave.lærerPoint })
                    }));
                    
                    // Build object and remove undefined values
                    const studentData = {
                        elevNavn: r.elevNavn || 'Ukendt',
                        karakter: r.karakter || 0,
                        totalPoint: r.totalPoint || 0,
                        antalDelopgaver: opgaverData.length,
                        // Include full detailed opgaver data with teacher points
                        opgaver: opgaverWithTeacherPoints,  // Array of individual exercises with all details
                        karakterBegrundelse: r.karakterBegrundelse || '',
                        samletFeedback: r.samletFeedback || '',
                        error: r.error || null
                    };
                    
                    // Only include teacher grading if it exists (not undefined)
                    if (r.lærerTotalPoint !== undefined) {
                        studentData.lærerTotalPoint = r.lærerTotalPoint;
                    }
                    if (r.lærerKarakter !== undefined) {
                        studentData.lærerKarakter = r.lærerKarakter;
                    }
                    
                    return studentData;
                }),
                gennemsnitKarakter: sessionResults.filter(r => !r.error).length > 0
                    ? parseFloat((sessionResults.filter(r => !r.error).reduce((acc, r) => acc + r.karakter, 0) / sessionResults.filter(r => !r.error).length).toFixed(1))
                    : 0,
                apiCost: sessionCost || 0,
                apiProvider: 'openai'
            };

            console.log('💾 History entry prepared:', historyEntry);
            console.log('💾 Opgaver in history:', historyEntry.opgaver[0]?.opgaver?.length || 0);

            const historyRef = collection(db, 'gradingHistory');
            const docRef = await addDoc(historyRef, historyEntry);
            console.log('✅ Successfully saved to gradingHistory:', docRef.id);
            
            const newEntry = { id: docRef.id, ...historyEntry };
            setGradingHistory([newEntry, ...gradingHistory]);
            localStorage.setItem('gradingHistory', JSON.stringify([newEntry, ...gradingHistory]));
            
            console.log('✅ Updated local state and localStorage');
        } catch (err) {
            console.error('❌ Error saving to gradingHistory:', err);
            console.error('❌ Error details:', err.message);
            console.error('❌ Error stack:', err.stack);
            
            // Fallback to localStorage only
            try {
                const historyEntry = {
                    dato: new Date().toISOString(),
                    examId: examId || null,
                    antalOpgaver: sessionResults.filter(r => !r.error).length,
                    opgaver: sessionResults.map(r => {
                        const opgaverData = r.opgaver || [];
                        
                        // Ensure each opgave includes lærerPoint if it exists
                        const opgaverWithTeacherPoints = opgaverData.map(opgave => ({
                            ...opgave,
                            ...(opgave.lærerPoint !== undefined && { lærerPoint: opgave.lærerPoint })
                        }));
                        
                        return {
                            elevNavn: r.elevNavn || 'Ukendt',
                            karakter: r.karakter || 0,
                            totalPoint: r.totalPoint || 0,
                            antalDelopgaver: opgaverData.length,
                            opgaver: opgaverWithTeacherPoints,
                            karakterBegrundelse: r.karakterBegrundelse || '',
                            samletFeedback: r.samletFeedback || '',
                            lærerTotalPoint: r.lærerTotalPoint,
                            lærerKarakter: r.lærerKarakter,
                            error: r.error || null
                        };
                    }),
                    gennemsnitKarakter: sessionResults.filter(r => !r.error).length > 0
                        ? parseFloat((sessionResults.filter(r => !r.error).reduce((acc, r) => acc + r.karakter, 0) / sessionResults.filter(r => !r.error).length).toFixed(1))
                        : 0,
                    apiCost: sessionCost || 0,
                    apiProvider: 'openai'
                };
                
                const newEntry = { id: Date.now().toString(), ...historyEntry };
                setGradingHistory([newEntry, ...gradingHistory]);
                localStorage.setItem('gradingHistory', JSON.stringify([newEntry, ...gradingHistory]));
                console.log('⚠️ Saved to localStorage only as fallback');
            } catch (localErr) {
                console.error('❌ Even localStorage save failed:', localErr);
            }
        }
    };

    const deleteHistoryEntry = async (id) => {
        try {
            const docRef = doc(db, 'gradingHistory', id);
            await deleteDoc(docRef);
            const updatedHistory = gradingHistory.filter(entry => entry.id !== id);
            setGradingHistory(updatedHistory);
            localStorage.setItem('gradingHistory', JSON.stringify(updatedHistory));
        } catch (err) {
            console.error('Fejl ved sletning:', err);
            const updatedHistory = gradingHistory.filter(entry => entry.id !== id);
            setGradingHistory(updatedHistory);
            localStorage.setItem('gradingHistory', JSON.stringify(updatedHistory));
        }
    };

    const clearAllHistory = async () => {
        if (confirm('Er du sikker på at du vil slette hele historikken?')) {
            try {
                const batch = writeBatch(db);
                const historyRef = collection(db, 'gradingHistory');
                const snapshot = await getDocs(historyRef);
                snapshot.docs.forEach(document => {
                    const docRef = doc(db, 'gradingHistory', document.id);
                    batch.delete(docRef);
                });
                await batch.commit();
                setGradingHistory([]);
                localStorage.removeItem('gradingHistory');
            } catch (err) {
                console.error('Fejl ved sletning:', err);
                setGradingHistory([]);
                localStorage.removeItem('gradingHistory');
            }
        }
    };

    const estimateAllMissingPrices = async () => {
        const entriesWithoutCost = gradingHistory.filter(e => !e.apiCost || e.apiCost === 0);
        if (entriesWithoutCost.length === 0) {
            alert('Alle posteringer har allerede en pris!');
            return;
        }
        if (confirm(`Vil du beregne estimeret pris for ${entriesWithoutCost.length} posteringer?\n\nEstimering: ca. $0.025 per elev.`)) {
            for (const entry of entriesWithoutCost) {
                const estimatedCost = entry.antalOpgaver * 0.025;
                try {
                    const docRef = doc(db, 'gradingHistory', entry.id);
                    await updateDoc(docRef, { apiCost: estimatedCost, priceEstimated: true });
                    const updatedHistory = gradingHistory.map(e => e.id === entry.id ? { ...e, apiCost: estimatedCost, priceEstimated: true } : e);
                    setGradingHistory(updatedHistory);
                    localStorage.setItem('gradingHistory', JSON.stringify(updatedHistory));
                } catch (err) {
                    console.error('Fejl:', err);
                }
            }
            alert(`✅ Estimeret pris er nu tilføjet til ${entriesWithoutCost.length} posteringer!`);
        }
    };

    return {
        gradingHistory,
        loadingHistory,
        loadHistoryFromFirestore,
        saveToHistory,
        deleteHistoryEntry,
        clearAllHistory,
        estimateAllMissingPrices
    };
}

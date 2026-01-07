/**
 * StudentResult Component
 * 
 * Én elevs resultat med AI og lærer vurdering
 * Inkluderer alle delopgaver og redigeringsmulighed
 */

import React, { useState, useEffect } from 'react';
import { OpgaveDetails } from './OpgaveDetails.jsx';
import { getFileDownloadURL } from '../services/storageService.js';
import { getSubmissions } from '../services/firestoreService.js';

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
    examId
}) {
    const [submissionPath, setSubmissionPath] = useState(null);

    /**
     * Load submission metadata to get correct storage path
     */
    useEffect(() => {
        const loadSubmissionPath = async () => {
            if (!examId || !result.submissionId) return;
            
            try {
                // Get all submissions for the exam
                const submissions = await getSubmissions(examId);
                
                // ✅ PRÆCIS match på submissionId
                let submission = submissions.find(sub => sub.id === result.submissionId);

                if (!submission && result.fileName) {
                    // Fallback: Prøv at matche på fileName
                    console.warn(`⚠️ No exact submissionId match for ${result.submissionId}, trying fileName fallback`);
                    const fileNameWithoutExt = result.fileName?.replace(/\.[^/.]+$/, '') || result.elevNavn?.replace(/\.[^/.]+$/, '');
                    submission = submissions.find(sub =>
                        sub.id === fileNameWithoutExt || sub.fileName === result.fileName
                    );
                }
                
                if (submission?.storagePath) {
                    setSubmissionPath(submission.storagePath);
                } else {
                    console.debug('No submission found for:', result.submissionId || result.elevNavn);
                }
            } catch (err) {
                console.debug('Error loading submission path:', err.message);
            }
        };
        
        loadSubmissionPath();
    }, [examId, result.submissionId, result.fileName, result.elevNavn]);

    /**
     * Open student submission in new tab
     */
    const handleOpenSubmission = async (e) => {
        e.preventDefault();
        try {
            if (!submissionPath) {
                throw new Error('Submission fil kunne ikke findes');
            }
            
            const url = await getFileDownloadURL(submissionPath);
            window.open(url, '_blank');
        } catch (err) {
            console.error('Error opening submission:', err);
            alert('Kunne ikke åbne opgaven: ' + err.message);
        }
    };
    // Handle error case
    if (result.error) {
        return (
            <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">{result.elevNavn}</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700">Fejl: {result.error}</p>
                </div>
            </div>
        );
    }

    // Calculate current teacher total if tempPoints exist
    let currentTotalPoint = result.totalPoint;
    let displaySource = "AI";
    
    if (result.opgaver && result.opgaver.length > 0) {
        let tempTotal = 0;
        let hasAnyTempPoints = false;
        
        result.opgaver.forEach((opgave, opIdx) => {
            const tempKey = `${index}-${opIdx}`;
            if (tempPoints[tempKey] !== undefined) {
                tempTotal += parseFloat(tempPoints[tempKey]) || 0;
                hasAnyTempPoints = true;
            } else if (opgave.lærerPoint !== undefined) {
                tempTotal += opgave.lærerPoint;
                hasAnyTempPoints = true;
            } else {
                tempTotal += opgave.givetPoint || 0;
            }
        });
        
        if (hasAnyTempPoints || result.lærerTotalPoint !== undefined) {
            currentTotalPoint = tempTotal;
            displaySource = "teacher";
        }
    } else if (result.lærerTotalPoint !== undefined) {
        currentTotalPoint = result.lærerTotalPoint;
        displaySource = "teacher";
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-3">
            <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-bold text-gray-800">{result.elevNavn}</h3>
                {examId && submissionPath && (
                    <a
                        href="#"
                        onClick={handleOpenSubmission}
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                        title="Åbn opgave i ny fane"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>Se opgave</span>
                    </a>
                )}
            </div>
            
            {/* AI's Vurdering (venstre) + Lærerens Vurdering (højre) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                {/* VENSTRE BLOK: AI's Vurdering + Karakterbegrundelse */}
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-300">
                    <p className="text-xs text-gray-600 mb-1 font-semibold">🤖 AI's Vurdering</p>
                    <div className="flex items-baseline gap-2 mb-2">
                        <div>
                            <p className="text-xs text-gray-500">Point</p>
                            <p className="text-lg font-bold text-blue-600">{result.totalPoint} / 75</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Karakter</p>
                            <p className="text-lg font-bold text-blue-600">{result.karakter}</p>
                        </div>
                    </div>
                    {/* Karakterbegrundelse moved here */}
                    {result.karakterBegrundelse && (
                        <div className="mt-2 pt-2 border-t border-blue-300">
                            <p className="text-xs font-semibold text-blue-900 mb-0.5">📊 Karakterbegrundelse:</p>
                            <p className="text-blue-800 text-xs">{result.karakterBegrundelse}</p>
                        </div>
                    )}
                </div>
                
                {/* HØJRE BLOK: Lærerens Vurdering */}
                <div className="bg-amber-50 rounded-lg p-2 border border-amber-400">
                    <p className="text-xs text-gray-600 mb-1 font-semibold">👨‍🏫 Lærerens Vurdering</p>
                    <div className="flex items-baseline gap-2">
                        <div>
                            <p className="text-xs text-gray-500">Point</p>
                            <p className="text-lg font-bold text-amber-700">
                                {currentTotalPoint} / 75
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Karakter</p>
                            <p className="text-lg font-bold text-amber-700">
                                {result.lærerKarakter !== undefined ? result.lærerKarakter : result.karakter}
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-amber-800 mt-2">
                        {displaySource === "teacher"
                            ? (editMode ? "Redigerer... Tryk 'Gem' for at beregne karakter" : "Lærer har rettet")
                            : "Urettet - viser AI's vurdering"}
                    </p>
                </div>
            </div>

            {/* Samlet feedback - more compact */}
            {result.samletFeedback && (
                <div className="mb-2 p-2 bg-gray-50 rounded-lg">
                    <p className="text-xs font-semibold text-gray-700 mb-0.5">Samlet feedback:</p>
                    <p className="text-gray-600 text-xs">{result.samletFeedback}</p>
                </div>
            )}

            {/* Delopgaver */}
            {result.opgaver && result.opgaver.length > 0 ? (
                <details className="cursor-pointer">
                    <summary className="font-semibold text-sm text-gray-700 hover:text-indigo-600 mb-2">
                        📋 Delopgaver ({result.opgaver.length} stk)
                    </summary>
                
                {/* Save button - always visible */}
                <div className="mb-2 p-2 bg-amber-50 border border-amber-400 rounded-lg">
                    <p className="text-amber-900 font-semibold text-xs mb-1">✏️ Ret lærer point nedenfor</p>
                    <p className="text-xs text-amber-800 mb-1.5">Ændringer gemmes og karakteren beregnes når du trykker "Gem"</p>
                    <div className="flex gap-2">
                        <button
                            onClick={onSaveEdit}
                            className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded transition-colors"
                        >
                            ✅ Gem og beregn karakter
                        </button>
                        {editMode && (
                            <button
                                onClick={onCancelEdit}
                                className="px-2 py-1 bg-gray-400 hover:bg-gray-500 text-white text-xs font-semibold rounded transition-colors"
                            >
                                ❌ Annuller
                            </button>
                        )}
                    </div>
                </div>
                
                    {/* Opgave list - reduced spacing */}
                    <div className="mt-2 space-y-1.5">
                        {result.opgaver.map((opgave, opIdx) => {
                        const feedbackKey = `${index}-${opIdx}`;
                        const tempKey = `${index}-${opIdx}`;
                        
                        return (
                            <OpgaveDetails
                                key={opIdx}
                                opgave={opgave}
                                opgaveIdx={opIdx}
                                resultIdx={index}
                                editMode={editMode}
                                lærerPoint={opgave.lærerPoint}
                                tempPoint={tempPoints[tempKey]}
                                onUpdateTempPoint={(value) => onUpdatePoint(index, opIdx, value)}
                                onStartEdit={onStartEdit}
                                detailedFeedback={detailedFeedback[feedbackKey]}
                                onAskAI={(customQuestion, imageBase64) => onAskAIDetails(index, opIdx, customQuestion, imageBase64)}
                                loadingDetailedFeedback={loadingDetailedFeedback === feedbackKey}
                            />
                        );
                        })}
                    </div>
                </details>
            ) : (
                <div className="mb-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 text-center">
                        📋 Ingen opgavedetaljer tilgængelige
                    </p>
                    <p className="text-xs text-gray-500 text-center mt-1">
                        Dette er en gammel retning uden detaljerede opgavedata
                    </p>
                </div>
            )}
        </div>
    );
}

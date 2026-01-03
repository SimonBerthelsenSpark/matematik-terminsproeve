/**
 * OpgaveDetails Component
 * 
 * Detaljer for én opgave med point redigering
 * Viser elevens svar, korrekt svar, feedback, og AI detaljer
 */

import React from 'react';
import { Loader2, MessageCircle } from './Icons.jsx';

export function OpgaveDetails({
    opgave,
    opgaveIdx,
    resultIdx,
    editMode = false,
    lærerPoint = null,
    tempPoint,
    onUpdateTempPoint,
    onStartEdit,
    detailedFeedback = null,
    onAskAI,
    loadingDetailedFeedback = false
}) {
    const needsHelp = opgave.givetPoint < opgave.maxPoint;
    const hasFeedback = detailedFeedback;

    return (
        <div className="border border-gray-300 rounded-lg p-2 bg-white">
            {/* Compact header with opgave number and points in one row */}
            <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-sm text-gray-800">Opgave {opgave.nummer}</span>
                
                {/* Inline compact points display */}
                <div className="flex items-center gap-3 text-xs">
                    <div className="text-center">
                        <p className="text-gray-500">Mulige</p>
                        <p className="font-bold text-gray-700">{opgave.maxPoint ?? '-'}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-blue-600">🤖 AI</p>
                        <p className="font-bold text-blue-600">{opgave.givetPoint}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-amber-600">👨‍🏫 Lærer</p>
                        <input
                            type="number"
                            min="0"
                            max={opgave.maxPoint}
                            step="0.5"
                            value={tempPoint !== undefined ? tempPoint : (opgave.lærerPoint !== undefined ? opgave.lærerPoint : opgave.givetPoint)}
                            onChange={(e) => {
                                // Auto-activate edit mode on first change
                                if (!editMode && onStartEdit) {
                                    onStartEdit();
                                }
                                onUpdateTempPoint(e.target.value);
                            }}
                            className="w-16 font-bold text-amber-700 bg-amber-50 border border-amber-400 rounded px-1 py-0.5 text-center text-xs"
                        />
                    </div>
                </div>
            </div>
            
            {/* Elevens svar */}
            {opgave.elevSvar && (
                <div className="mb-1 p-1.5 bg-blue-50 border border-blue-200 rounded">
                    <p className="text-xs font-semibold text-blue-900 mb-0.5">📝 Elevens svar:</p>
                    <p className="text-xs text-gray-700">{opgave.elevSvar}</p>
                </div>
            )}
            
            {/* Korrekt svar */}
            {opgave.korrektSvar && (
                <div className="mb-1 p-1.5 bg-green-50 border border-green-200 rounded">
                    <p className="text-xs font-semibold text-green-900 mb-0.5">✅ Korrekt svar:</p>
                    <p className="text-xs text-gray-700">{opgave.korrektSvar}</p>
                </div>
            )}
            
            {/* Feedback */}
            <div className="p-1.5 bg-white border border-gray-200 rounded mb-1">
                <p className="text-xs font-semibold text-gray-700 mb-0.5">💬 Feedback:</p>
                <p className="text-xs text-gray-600">{opgave.feedback}</p>
            </div>
            
            {/* Ask AI for more details button - only show if not full points */}
            {needsHelp && (
                <div className="mt-2">
                    {!hasFeedback ? (
                        <button
                            onClick={onAskAI}
                            disabled={loadingDetailedFeedback}
                            className="w-full px-2 py-1.5 bg-indigo-100 hover:bg-indigo-200 disabled:bg-gray-200 text-indigo-800 disabled:text-gray-500 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors"
                        >
                            {loadingDetailedFeedback ? (
                                <>
                                    <Loader2 />
                                    <span>Spørger AI...</span>
                                </>
                            ) : (
                                <>
                                    <MessageCircle />
                                    <span>🤖 Spørg AI: Hvad mangler jeg?</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <div className={`p-2 rounded-lg border-2 ${hasFeedback.error ? 'bg-red-50 border-red-300' : 'bg-indigo-50 border-indigo-300'}`}>
                            <div className="flex items-start gap-1.5 mb-1">
                                <span className="text-lg">🤖</span>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-indigo-900 mb-1">AI Forklaring - Hvad mangler der:</p>
                                    <p className={`text-xs ${hasFeedback.error ? 'text-red-700' : 'text-indigo-800'} whitespace-pre-line`}>
                                        {hasFeedback.text}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

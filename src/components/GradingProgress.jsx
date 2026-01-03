/**
 * GradingProgress Component
 * 
 * Viser fremskridt under rettelse med detaljeret status
 * Inkluderer progress bar, retry info, og debug information
 */

import React from 'react';
import { Loader2 } from './Icons.jsx';

export function GradingProgress({
    statusMessage,
    currentTaskPhase = '',
    completedCount = 0,
    totalCount = 0,
    retryInfo = null,
    requestDebugInfo = null,
    currentFileName = ''
}) {
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            {/* Hovedstatus besked */}
            <p className="text-blue-800 font-medium text-center text-lg mb-3">{statusMessage}</p>
            
            {/* Progress bar */}
            {totalCount > 0 && (
                <div className="mb-3">
                    <div className="flex justify-between text-xs text-blue-700 mb-1">
                        <span>Fremskridt</span>
                        <span>{completedCount} af {totalCount} elever</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-3">
                        <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-blue-600 text-center mt-1">
                        {progressPercent}% færdig
                    </p>
                </div>
            )}
            
            {/* Detaljeret status box */}
            <div className="bg-white border border-blue-300 rounded p-3 mb-3">
                <p className="text-sm font-semibold text-blue-900 mb-2">📋 Nuværende proces:</p>
                <div className="grid grid-cols-1 gap-2 text-xs text-gray-700">
                    {completedCount > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-green-600">✅</span>
                            <span><strong>Færdige:</strong> {completedCount} elever</span>
                        </div>
                    )}
                    {completedCount < totalCount && (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="text-blue-600 animate-pulse">🔄</span>
                                <span><strong>Arbejder på:</strong> {currentFileName || 'Næste elev'}</span>
                            </div>
                            {currentTaskPhase && (
                                <div className="flex items-center gap-2 ml-4">
                                    <span className="text-purple-600">⚡</span>
                                    <span className="text-purple-700 italic">{currentTaskPhase}</span>
                                </div>
                            )}
                        </>
                    )}
                    {totalCount - completedCount > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">⏳</span>
                            <span><strong>I kø:</strong> {totalCount - completedCount - 1} elever</span>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Retry information */}
            {retryInfo && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-300 rounded text-sm text-center">
                    <p className="font-semibold text-yellow-800">⚠️ Retry Information</p>
                    <p className="text-yellow-700">Prøver igen for: {retryInfo.elevNavn}</p>
                    <p className="text-yellow-700">Forsøg {retryInfo.attempt} af {retryInfo.maxRetries}</p>
                </div>
            )}
            
            {/* Debug info */}
            {requestDebugInfo && (
                <div className="mt-3 p-3 bg-white border border-blue-300 rounded text-left">
                    <p className="font-semibold text-blue-900 text-sm mb-2">📊 Debug Info - Hvad der sendes:</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="text-gray-700"><strong>System prompt:</strong> {requestDebugInfo.systemPromptSize}</div>
                        <div className="text-gray-700"><strong>User prompt:</strong> {requestDebugInfo.userPromptSize}</div>
                        <div className="text-gray-700"><strong>Rettevejledning:</strong> {requestDebugInfo.rettevejledningSize}</div>
                        <div className="text-gray-700"><strong>Omsætningstabel:</strong> {requestDebugInfo.omsætningstabelSize}</div>
                        <div className="text-gray-700"><strong>Elevbesvarelse:</strong> {requestDebugInfo.elevbesvarelseSize}</div>
                        <div className="text-gray-700 col-span-2"><strong>Endpoint:</strong> {requestDebugInfo.endpoint.substring(0, 50)}...</div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">💡 Se browser console (F12) for fuld detaljer</p>
                </div>
            )}
        </div>
    );
}

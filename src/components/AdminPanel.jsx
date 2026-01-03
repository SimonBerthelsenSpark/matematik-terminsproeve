/**
 * AdminPanel Component
 * 
 * Administrationspanel med historik og prisberegning
 * Håndterer Firebase Firestore integration for gemning af retningshistorik
 */

import React from 'react';
import { Database, Trash2, Loader2 } from './Icons.jsx';

export function AdminPanel({
    gradingHistory = [],
    loadingHistory = false,
    onDeleteEntry,
    onClearAll,
    onEstimatePrices,
    examId = null
}) {
    const totalCost = gradingHistory.reduce((sum, e) => sum + (e.apiCost || 0), 0);
    const entriesWithoutCost = gradingHistory.filter(e => !e.apiCost || e.apiCost === 0);

    return (
        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Database />
                        Log {examId ? '(Kun denne prøve)' : '(Alle prøver)'}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Gemt i Firebase Cloud
                    </p>
                </div>
                {gradingHistory.length > 0 && (
                    <div className="flex gap-2">
                        {entriesWithoutCost.length > 0 && (
                            <button
                                onClick={onEstimatePrices}
                                className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg"
                            >
                                💰 Beregn manglende priser
                            </button>
                        )}
                        <button
                            onClick={onClearAll}
                            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg flex items-center gap-2"
                        >
                            <Trash2 />
                            Slet alt
                        </button>
                    </div>
                )}
            </div>
            
            {loadingHistory ? (
                <div className="text-center py-8">
                    <Loader2 />
                    <p className="mt-2 text-gray-600">Indlæser historik fra Firebase...</p>
                </div>
            ) : gradingHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Database />
                    <p className="mt-2">Ingen retningshistorik endnu</p>
                    <p className="text-sm">Historik gemmes automatisk i Firebase efter hver retning</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-purple-100">
                            <tr>
                                <th className="px-4 py-2 text-left font-semibold">Dato</th>
                                <th className="px-4 py-2 text-left font-semibold">Opgaver rettet</th>
                                <th className="px-4 py-2 text-left font-semibold">Gns. karakter</th>
                                <th className="px-4 py-2 text-left font-semibold">API Pris</th>
                                <th className="px-4 py-2 text-left font-semibold">Provider</th>
                                <th className="px-4 py-2 text-center font-semibold">Detaljer</th>
                                <th className="px-4 py-2 text-center font-semibold">Slet</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white">
                            {gradingHistory.map((entry) => (
                                <React.Fragment key={entry.id}>
                                    <tr className="border-b border-purple-100 hover:bg-purple-50">
                                        <td className="px-4 py-3">
                                            {new Date(entry.dato).toLocaleString('da-DK', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-indigo-600">
                                            {entry.antalOpgaver} opgaver
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">
                                                {entry.gennemsnitKarakter}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {typeof entry.apiCost === 'number' && !isNaN(entry.apiCost) ? (
                                                <div className="flex flex-col">
                                                    <span className={`font-semibold ${entry.apiCost > 0 ? 'text-green-700' : 'text-gray-600'}`}>
                                                        ${entry.apiCost.toFixed(4)}
                                                    </span>
                                                    <span className={`text-xs ${entry.apiCost > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                                                        ca. {(entry.apiCost * 7).toFixed(2)} kr
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="text-gray-600 text-xs">$0.0000</span>
                                                    <span className="text-gray-500 text-xs">ca. 0.00 kr</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                                                🤖 ChatGPT-4o
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <details className="inline-block">
                                                <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 font-medium">
                                                    Vis
                                                </summary>
                                                <div className="absolute z-10 mt-2 p-4 bg-white border border-gray-300 rounded-lg shadow-lg max-w-md">
                                                    <h4 className="font-bold mb-2">Elevresultater:</h4>
                                                    <div className="max-h-60 overflow-y-auto space-y-2">
                                                        {entry.opgaver.map((opgave, idx) => (
                                                            <div key={idx} className="p-2 bg-gray-50 rounded text-xs">
                                                                {opgave.error ? (
                                                                    <>
                                                                        <p className="font-semibold text-red-600">{opgave.elevNavn}</p>
                                                                        <p className="text-red-500">Fejl: {opgave.error}</p>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <p className="font-semibold">{opgave.elevNavn}</p>
                                                                        <p>Karakter: <span className="font-bold text-green-600">{opgave.karakter}</span></p>
                                                                        <p>Point: {opgave.totalPoint}/75</p>
                                                                        <p>Delopgaver: {opgave.antalDelopgaver}</p>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </details>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => onDeleteEntry(entry.id)}
                                                className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                            >
                                                <Trash2 />
                                            </button>
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Total cost summary */}
                    {gradingHistory.length > 0 && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-green-900">
                                        💰 Total omkostninger: ${totalCost.toFixed(4)}
                                    </p>
                                    <p className="text-xs text-green-700 mt-1">
                                        Baseret på {gradingHistory.length} retningssessioner
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-green-800">
                                        ca. {(totalCost * 7).toFixed(2)} kr
                                    </p>
                                    <p className="text-xs text-green-600">i danske kroner</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/**
 * ResultsOverview Component
 * 
 * Statistik oversigt (antal prøver, gennemsnit, højeste karakter, etc.)
 */

import React from 'react';

export function ResultsOverview({ results = [] }) {
    // Filter out errors
    const validResults = results.filter(r => !r.error);
    
    // Calculate statistics
    const totalCount = results.length;
    const avgGrade = validResults.length > 0 
        ? (validResults.reduce((acc, r) => acc + r.karakter, 0) / validResults.length).toFixed(1)
        : 0;
    const avgPoints = validResults.length > 0
        ? (validResults.reduce((acc, r) => acc + r.totalPoint, 0) / validResults.length).toFixed(0)
        : 0;
    const highestGrade = validResults.length > 0
        ? Math.max(...validResults.map(r => r.karakter))
        : 0;

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Oversigt</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Antal prøver</p>
                    <p className="text-3xl font-bold text-blue-600">{totalCount}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Gns. karakter</p>
                    <p className="text-3xl font-bold text-green-600">{avgGrade}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Gns. point</p>
                    <p className="text-3xl font-bold text-purple-600">{avgPoints}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4 text-center">
                    <p className="text-sm text-gray-600 mb-1">Højeste</p>
                    <p className="text-3xl font-bold text-yellow-600">{highestGrade}</p>
                </div>
            </div>
        </div>
    );
}

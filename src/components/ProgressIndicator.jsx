/**
 * ProgressIndicator Component
 * 
 * Viser step-by-step fremskridt (Upload → Ret → Resultat)
 * Simpleste komponent - ingen state, kun visuel indikator
 */

import React from 'react';

export function ProgressIndicator({ currentStep = 1 }) {
    return (
        <div className="flex items-center gap-4 mt-6">
            {/* Step 1: Upload */}
            <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                    1
                </div>
                <span className="font-medium">Upload</span>
            </div>

            {/* Progress bar 1→2 */}
            <div className="flex-1 h-1 bg-gray-200 rounded">
                <div className={`h-full bg-indigo-600 rounded transition-all ${currentStep >= 2 ? 'w-full' : 'w-0'}`}></div>
            </div>

            {/* Step 2: Ret */}
            <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                    2
                </div>
                <span className="font-medium">Ret</span>
            </div>

            {/* Progress bar 2→3 */}
            <div className="flex-1 h-1 bg-gray-200 rounded">
                <div className={`h-full bg-indigo-600 rounded transition-all ${currentStep >= 3 ? 'w-full' : 'w-0'}`}></div>
            </div>

            {/* Step 3: Resultat */}
            <div className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-indigo-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>
                    3
                </div>
                <span className="font-medium">Resultat</span>
            </div>
        </div>
    );
}

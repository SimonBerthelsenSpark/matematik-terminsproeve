/**
 * OpgaveDetails Component
 *
 * Detaljer for én opgave med point redigering
 * Viser elevens svar, korrekt svar, feedback, og AI detaljer
 */

import React, { useState } from 'react';
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
    onClearFeedback,
    loadingDetailedFeedback = false
}) {
    const [customQuestion, setCustomQuestion] = useState('');
    const [showQuestionInput, setShowQuestionInput] = useState(false);
    const [uploadedImage, setUploadedImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    
    const needsHelp = opgave.givetPoint < opgave.maxPoint;
    const hasFeedback = detailedFeedback;
    
    const handleAskNewQuestion = () => {
        if (onClearFeedback) {
            onClearFeedback();
        }
        setShowQuestionInput(true);
        setCustomQuestion('');
        removeImage();
    };
    
    const handleAskCustomQuestion = () => {
        if (customQuestion.trim()) {
            onAskAI(customQuestion, uploadedImage);
            setCustomQuestion('');
            setUploadedImage(null);
            setImagePreview(null);
            setShowQuestionInput(false);
        }
    };
    
    const handleImageUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setImagePreview(e.target.result);
                setUploadedImage(e.target.result); // base64 string
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (e) => {
                    setImagePreview(e.target.result);
                    setUploadedImage(e.target.result); // base64 string
                };
                reader.readAsDataURL(blob);
                e.preventDefault();
                break;
            }
        }
    };
    
    const removeImage = () => {
        setUploadedImage(null);
        setImagePreview(null);
    };

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
            
            {/* Ask AI for more details */}
            <div className="mt-2">
                {!showQuestionInput && !hasFeedback ? (
                    <div className="flex gap-2">
                        {/* Quick default question */}
                        <button
                            onClick={() => onAskAI()}
                            disabled={loadingDetailedFeedback}
                            className="flex-1 px-2 py-1.5 bg-indigo-100 hover:bg-indigo-200 disabled:bg-gray-200 text-indigo-800 disabled:text-gray-500 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors"
                        >
                            {loadingDetailedFeedback ? (
                                <>
                                    <Loader2 />
                                    <span>Spørger AI...</span>
                                </>
                            ) : (
                                <>
                                    <MessageCircle />
                                    <span>🤖 Hvad mangler jeg?</span>
                                </>
                            )}
                        </button>
                        
                        {/* Custom question button */}
                        <button
                            onClick={() => setShowQuestionInput(true)}
                            disabled={loadingDetailedFeedback}
                            className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 disabled:bg-gray-200 text-purple-800 disabled:text-gray-500 text-xs font-medium rounded transition-colors"
                            title="Stil dit eget spørgsmål"
                        >
                            ✏️
                        </button>
                    </div>
                ) : showQuestionInput && !hasFeedback ? (
                    <div className="space-y-2">
                        <div className="flex items-start gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-semibold text-purple-900 mb-1">
                                    💬 Stil dit spørgsmål til AI:
                                </label>
                                <textarea
                                    value={customQuestion}
                                    onChange={(e) => setCustomQuestion(e.target.value)}
                                    onPaste={handlePaste}
                                    placeholder="Fx: Hvorfor har eleven fået 0 i denne opgave når der er en tegning? (Du kan paste et screenshot med Ctrl+V)"
                                    className="w-full px-2 py-1.5 text-xs border border-purple-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                    rows="3"
                                    disabled={loadingDetailedFeedback}
                                />
                            </div>
                        </div>
                        
                        {/* Image upload/paste area */}
                        <div className="space-y-2">
                            {!imagePreview ? (
                                <div className="flex gap-2">
                                    <label className="flex-1 cursor-pointer">
                                        <div className="px-2 py-1.5 bg-purple-100 hover:bg-purple-200 border-2 border-dashed border-purple-300 text-purple-700 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors">
                                            <span>📷</span>
                                            <span>Upload screenshot/billede</span>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="hidden"
                                            disabled={loadingDetailedFeedback}
                                        />
                                    </label>
                                    <div className="flex-1 px-2 py-1.5 bg-gray-50 border border-gray-300 text-gray-600 text-xs rounded flex items-center justify-center text-center">
                                        eller paste (Ctrl+V) direkte i tekstfeltet
                                    </div>
                                </div>
                            ) : (
                                <div className="relative border-2 border-purple-300 rounded-lg p-2 bg-purple-50">
                                    <div className="flex items-start gap-2">
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="max-w-full max-h-40 rounded border border-purple-200"
                                        />
                                        <button
                                            onClick={removeImage}
                                            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
                                            disabled={loadingDetailedFeedback}
                                        >
                                            ❌
                                        </button>
                                    </div>
                                    <p className="text-xs text-purple-700 mt-1">
                                        ✅ Billede vedhæftet - AI'en vil analysere dette sammen med dit spørgsmål
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex gap-2">
                            <button
                                onClick={handleAskCustomQuestion}
                                disabled={loadingDetailedFeedback || !customQuestion.trim()}
                                className="flex-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white disabled:text-gray-500 text-xs font-medium rounded flex items-center justify-center gap-1.5 transition-colors"
                            >
                                {loadingDetailedFeedback ? (
                                    <>
                                        <Loader2 />
                                        <span>Spørger AI...</span>
                                    </>
                                ) : (
                                    <>
                                        <MessageCircle />
                                        <span>Spørg AI {uploadedImage ? '(med billede)' : ''}</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => {
                                    setShowQuestionInput(false);
                                    setCustomQuestion('');
                                    removeImage();
                                }}
                                disabled={loadingDetailedFeedback}
                                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-200 text-gray-700 disabled:text-gray-400 text-xs font-medium rounded transition-colors"
                            >
                                Annuller
                            </button>
                        </div>
                    </div>
                ) : hasFeedback ? (
                    <div className="space-y-2">
                        <div className={`p-2 rounded-lg border-2 ${hasFeedback.error ? 'bg-red-50 border-red-300' : 'bg-indigo-50 border-indigo-300'}`}>
                            <div className="flex items-start gap-1.5 mb-1">
                                <span className="text-lg">🤖</span>
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-indigo-900 mb-1">
                                        {hasFeedback.customQuestion ? 'AI Svar:' : 'AI Forklaring - Hvad mangler der:'}
                                    </p>
                                    {hasFeedback.customQuestion && (
                                        <p className="text-xs text-purple-700 italic mb-2 pb-2 border-b border-indigo-200">
                                            "{hasFeedback.customQuestion}"
                                        </p>
                                    )}
                                    <p className={`text-xs ${hasFeedback.error ? 'text-red-700' : 'text-indigo-800'} whitespace-pre-line`}>
                                        {hasFeedback.text}
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Allow asking another question */}
                        <button
                            onClick={handleAskNewQuestion}
                            className="w-full px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-medium rounded transition-colors"
                        >
                            ✏️ Stil et nyt spørgsmål
                        </button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

/**
 * Detaljer for én opgave: elevens svar, facit og mulighed for at spørge AI.
 */
import React, { useState } from 'react';
import { Loader2, MessageCircle, Image, X } from './Icons.jsx';

export function OpgaveDetails({ opgave, detailedFeedback = null, onAskAI, onClearFeedback, loadingDetailedFeedback = false }) {
    const [question, setQuestion] = useState('');
    const [asking, setAsking] = useState(false);
    const [image, setImage] = useState(null);

    const readImage = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => setImage(e.target.result);
        reader.readAsDataURL(file);
    };

    const handlePaste = (e) => {
        const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image'));
        if (item) {
            readImage(item.getAsFile());
            e.preventDefault();
        }
    };

    const submit = (e) => {
        e.preventDefault();
        if (!question.trim()) return;
        onAskAI(question.trim(), image);
        setQuestion('');
        setImage(null);
        setAsking(false);
    };

    return (
        <div className="sm:ml-6 rounded-control bg-paper p-3 sm:p-4 space-y-4 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                    <dt className="text-[13px] font-semibold text-ink-soft">Elevens svar</dt>
                    <dd className="mt-0.5 whitespace-pre-line">{opgave.elevSvar || <span className="text-ink-faint">Ikke besvaret</span>}</dd>
                </div>
                <div>
                    <dt className="text-[13px] font-semibold text-ink-soft">Facit</dt>
                    <dd className="mt-0.5 whitespace-pre-line">{opgave.korrektSvar || '–'}</dd>
                </div>
            </dl>

            {detailedFeedback ? (
                <div className={`rounded-control border bg-surface p-3 ${detailedFeedback.error ? 'border-[#F1CFCA]' : 'border-line'}`}>
                    {detailedFeedback.customQuestion && (
                        <p className="text-[13px] text-ink-soft mb-1.5">Du spurgte: {detailedFeedback.customQuestion}</p>
                    )}
                    <p className={`whitespace-pre-line ${detailedFeedback.error ? 'text-pen' : ''}`}>{detailedFeedback.text}</p>
                    <button type="button" className="btn-ghost btn-sm mt-2 -ml-2" onClick={() => { onClearFeedback(); setAsking(true); }}>
                        Stil et nyt spørgsmål
                    </button>
                </div>
            ) : asking ? (
                <form onSubmit={submit} className="space-y-2">
                    <label htmlFor={`q-${opgave.nummer}`} className="field-label">Dit spørgsmål til AI</label>
                    <textarea
                        id={`q-${opgave.nummer}`}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onPaste={handlePaste}
                        rows={3}
                        className="input h-auto py-2 resize-y"
                        placeholder="Fx: Eleven har tegnet grafen – hvorfor 0 point? Du kan indsætte et skærmbillede med Ctrl+V."
                        disabled={loadingDetailedFeedback}
                        autoFocus
                    />
                    {image && (
                        <div className="flex items-start gap-2">
                            <img src={image} alt="Vedhæftet skærmbillede" className="max-h-32 rounded border border-line" />
                            <button type="button" className="btn-icon" onClick={() => setImage(null)} aria-label="Fjern billede"><X /></button>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" className="btn-primary btn-sm" disabled={!question.trim() || loadingDetailedFeedback}>
                            {loadingDetailedFeedback ? <Loader2 /> : <MessageCircle className="w-3.5 h-3.5" />} Spørg AI
                        </button>
                        {!image && (
                            <label className="btn-secondary btn-sm cursor-pointer">
                                <Image className="w-3.5 h-3.5" /> Vedhæft billede
                                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => readImage(e.target.files?.[0])} />
                            </label>
                        )}
                        <button type="button" className="btn-ghost btn-sm" onClick={() => { setAsking(false); setImage(null); }}>Annuller</button>
                    </div>
                </form>
            ) : (
                <div className="flex flex-wrap gap-2">
                    {opgave.givetPoint < opgave.maxPoint && (
                        <button type="button" className="btn-secondary btn-sm" onClick={() => onAskAI()} disabled={loadingDetailedFeedback}>
                            {loadingDetailedFeedback ? <Loader2 /> : <MessageCircle className="w-3.5 h-3.5" />}
                            Hvad mangler eleven?
                        </button>
                    )}
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setAsking(true)} disabled={loadingDetailedFeedback}>
                        Stil eget spørgsmål
                    </button>
                </div>
            )}
        </div>
    );
}

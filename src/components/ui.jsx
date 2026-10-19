/**
 * Fælles UI-byggesten. Hold sider simple ved at bruge disse frem for at style knapper og felter på ny.
 */
import React, { useEffect, useRef, useState, useCallback, createContext, useContext } from 'react';
import { formatKarakter } from '../utils/karakter.js';
import { AlertCircle, Loader2, Upload, FileText, X } from './Icons.jsx';

// ==================== Formatering ====================

export function formatDato(date) {
    if (!date) return '–';
    const d = date.toDate ? date.toDate() : date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '–';
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "12_Søren Hansen.pdf" → "Søren Hansen" */
export function elevnavnFraFil(fileName) {
    if (!fileName) return '';
    return String(fileName).replace(/\.[^/.]+$/, '').replace(/^\d+[_\s-]+/, '').replace(/_+/g, ' ').trim();
}

/** "12_Søren Hansen.pdf" → "12" */
export function elevnummerFraFil(fileName) {
    const m = String(fileName || '').match(/^(\d+)[_\s-]/);
    return m ? m[1] : '';
}

// ==================== Sidehoved ====================

export function PageHeader({ title, description, actions, children }) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
            <div className="min-w-0">
                <h1 className="text-[26px] leading-tight font-semibold">{title}</h1>
                {description && <p className="mt-1 text-ink-soft max-w-prose">{description}</p>}
                {children}
            </div>
            {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
        </div>
    );
}

export function Section({ title, description, actions, children, className = '' }) {
    return (
        <section className={`surface ${className}`}>
            {(title || actions) && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between px-5 pt-5">
                    <div>
                        {title && <h2 className="text-[17px] font-semibold">{title}</h2>}
                        {description && <p className="text-sm text-ink-soft mt-0.5 max-w-prose">{description}</p>}
                    </div>
                    {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
                </div>
            )}
            <div className="p-5">{children}</div>
        </section>
    );
}

// ==================== Karaktermærke ====================

/**
 * Karaktermærket er appens gennemgående element:
 *  - stiplet kant = AI-forslag (endnu ikke godkendt)
 *  - udfyldt     = godkendt af læreren
 */
export function GradeMark({ karakter, approved = false, size = 'md', title }) {
    if (karakter === null || karakter === undefined || Number.isNaN(karakter)) {
        return <span className="text-ink-faint">–</span>;
    }
    const sizes = {
        sm: 'h-7 min-w-[2.25rem] text-[13px]',
        md: 'h-9 min-w-[2.75rem] text-[15px]',
        lg: 'h-14 min-w-[4rem] text-[26px]'
    };
    const style = approved
        ? 'bg-ink text-white border-2 border-ink'
        : 'bg-surface text-ink border-2 border-dashed border-ink-faint';
    return (
        <span
            className={`num inline-flex items-center justify-center px-2 rounded-control font-semibold ${sizes[size]} ${style}`}
            title={title || (approved ? 'Godkendt af dig' : 'AI-forslag – ikke godkendt endnu')}
        >
            {formatKarakter(karakter)}
        </span>
    );
}

export function GradeLegend() {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded-[4px] border-2 border-dashed border-ink-faint" /> AI-forslag
            </span>
            <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-4 h-4 rounded-[4px] bg-ink" /> Godkendt af dig
            </span>
        </div>
    );
}

// ==================== Status ====================

const TONES = {
    neutral: 'bg-paper text-ink-soft border-line',
    attention: 'bg-pen-soft text-pen border-[#F1CFCA]',
    ok: 'bg-ok-soft text-ok border-[#CFE3D7]',
    info: 'bg-[#EAF0F8] text-[#2D5182] border-[#D3DFEE]'
};

export function StatusPill({ tone = 'neutral', children }) {
    return (
        <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[12.5px] font-medium whitespace-nowrap ${TONES[tone]}`}>
            {children}
        </span>
    );
}

export function Notice({ tone = 'attention', title, children, action }) {
    const tones = {
        attention: 'border-[#F1CFCA] bg-pen-soft text-pen',
        info: 'border-[#D3DFEE] bg-[#EAF0F8] text-[#2D5182]',
        ok: 'border-[#CFE3D7] bg-ok-soft text-ok'
    };
    return (
        <div className={`flex gap-3 rounded-surface border px-4 py-3 ${tones[tone]}`} role={tone === 'attention' ? 'alert' : 'status'}>
            <AlertCircle className="w-[18px] h-[18px] mt-0.5" />
            <div className="flex-1 text-sm">
                {title && <p className="font-semibold">{title}</p>}
                {children && <div className={title ? 'mt-0.5 text-ink' : 'text-ink'}>{children}</div>}
            </div>
            {action}
        </div>
    );
}

export function Spinner({ label = 'Indlæser…' }) {
    return (
        <div className="flex items-center justify-center gap-2 py-16 text-ink-soft" role="status">
            <Loader2 className="w-5 h-5" />
            <span>{label}</span>
        </div>
    );
}

export function EmptyState({ title, children, action }) {
    return (
        <div className="text-center py-14 px-6">
            <p className="text-[17px] font-semibold">{title}</p>
            {children && <p className="mt-1 text-ink-soft max-w-md mx-auto">{children}</p>}
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

// ==================== Fil-felt ====================

/**
 * Filvælger der ligner resten af appen.
 * @param {Object} props
 * @param {Object|null} props.current - eksisterende fil { fileName }
 * @param {File|null} props.selected - valgt, endnu ikke uploadet fil
 */
export function FileField({ id, label, hint, accept, current, selected, onSelect, onUpload, uploading, onOpen }) {
    const inputRef = useRef(null);
    return (
        <div>
            {label && <label htmlFor={id} className="field-label">{label}</label>}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center rounded-control border border-line-strong bg-surface px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-[18px] h-[18px] text-ink-soft" />
                    {selected ? (
                        <span className="truncate text-sm">{selected.name} <span className="text-ink-soft">(ikke uploadet)</span></span>
                    ) : current ? (
                        onOpen ? (
                            <button type="button" onClick={onOpen} className="truncate text-sm underline decoration-line-strong underline-offset-2 hover:decoration-ink text-left">
                                {current.fileName}
                            </button>
                        ) : (
                            <span className="truncate text-sm">{current.fileName}</span>
                        )
                    ) : (
                        <span className="text-sm text-ink-faint">Ingen fil valgt</span>
                    )}
                </div>
                <div className="flex gap-2 shrink-0">
                    <input
                        ref={inputRef}
                        id={id}
                        type="file"
                        accept={accept}
                        className="sr-only"
                        onChange={(e) => { onSelect?.(e.target.files?.[0] || null); e.target.value = ''; }}
                    />
                    <button type="button" className="btn-secondary btn-sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
                        {current || selected ? 'Vælg en anden' : 'Vælg fil'}
                    </button>
                    {selected && onUpload && (
                        <button type="button" className="btn-primary btn-sm" onClick={onUpload} disabled={uploading}>
                            {uploading ? <Loader2 /> : <Upload className="w-4 h-4" />}
                            {uploading ? 'Uploader…' : current ? 'Erstat' : 'Upload'}
                        </button>
                    )}
                    {selected && !onUpload && (
                        <button type="button" className="btn-icon" onClick={() => onSelect?.(null)} aria-label="Fjern valgt fil">
                            <X />
                        </button>
                    )}
                </div>
            </div>
            {hint && <p className="field-hint">{hint}</p>}
        </div>
    );
}

// ==================== Bekræftelsesdialog ====================

const ConfirmContext = createContext(null);

/**
 * Giver `useConfirm()`, der erstatter window.confirm med en rigtig dialog.
 *   const confirm = useConfirm();
 *   if (await confirm({ title, message, confirmLabel, danger: true })) { ... }
 */
export function ConfirmProvider({ children }) {
    const [state, setState] = useState(null);
    const resolver = useRef(null);

    const confirm = useCallback((opts) => new Promise((resolve) => {
        resolver.current = resolve;
        setState(opts);
    }), []);

    const close = (value) => {
        resolver.current?.(value);
        resolver.current = null;
        setState(null);
    };

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state && <ConfirmDialog {...state} onCancel={() => close(false)} onConfirm={() => close(true)} />}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const ctx = useContext(ConfirmContext);
    // Fallback hvis provideren mangler (fx i tests)
    return ctx || (async ({ message, title }) => window.confirm([title, message].filter(Boolean).join('\n\n')));
}

function ConfirmDialog({ title, message, confirmLabel = 'Bekræft', cancelLabel = 'Annuller', danger = false, onCancel, onConfirm }) {
    const confirmRef = useRef(null);
    const cancelRef = useRef(null);

    useEffect(() => {
        (danger ? cancelRef : confirmRef).current?.focus();
        const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [danger, onCancel]);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="absolute inset-0 bg-ink/40" onClick={onCancel} />
            <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="relative w-full max-w-md bg-surface rounded-surface shadow-xl p-6">
                <h2 id="confirm-title" className="text-[17px] font-semibold">{title}</h2>
                {message && <div className="mt-2 text-sm text-ink-soft whitespace-pre-line">{message}</div>}
                <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button ref={cancelRef} type="button" className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
                    <button ref={confirmRef} type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}

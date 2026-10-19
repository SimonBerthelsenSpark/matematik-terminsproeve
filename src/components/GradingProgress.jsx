import React from 'react';
import { Loader2 } from './Icons.jsx';

/**
 * Fremdrift mens AI retter. Holdt rolig: én bjælke og én linje om hvad der sker.
 */
export function GradingProgress({ statusMessage, currentTaskPhase = '', completedCount = 0, totalCount = 0, retryInfo = null, currentFileName = '' }) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <section className="surface p-5" aria-live="polite" aria-label="Retning i gang">
      <div className="flex items-center justify-between gap-4">
        <p className="font-semibold flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-ink-soft" />
          Retter {currentFileName || 'besvarelser'}
        </p>
        <p className="num text-sm text-ink-soft">{completedCount} af {totalCount}</p>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-line overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={totalCount} aria-valuenow={completedCount}>
        <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-ink-soft">
        {retryInfo
          ? `AI er travl – prøver igen om lidt (forsøg ${retryInfo.attempt} af ${retryInfo.maxRetries}).`
          : (currentTaskPhase || statusMessage || 'Arbejder…').replace(/^[^\p{L}\p{N}]+/u, '')}
      </p>
      <p className="mt-1 text-[13px] text-ink-faint">Du kan blive på siden – resultaterne dukker op, efterhånden som de er klar.</p>
    </section>
  );
}

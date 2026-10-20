/**
 * Visning af AI-forbrug (tokens og anslået pris).
 */
import React from 'react';
import { formatTokens, formatKr, formatUSD, totalTokens, resultatForbrug } from '../utils/usage.js';

/** Forbrug for én besvarelse – vises i panelet ved karakteren. */
export function BesvarelseForbrug({ result }) {
  const { usage, cost, harTokens } = resultatForbrug(result);
  if (!harTokens && !cost) return null;
  return (
    <div className="px-1 text-[13px] text-ink-soft">
      <p className="font-semibold text-ink text-sm">AI-forbrug</p>
      {harTokens ? (
        <>
          <p>
            <span className="num">{formatTokens(totalTokens(usage))}</span> tokens · ca. <span className="num" title={formatUSD(cost)}>{formatKr(cost)}</span>
          </p>
          <p>
            Ind <span className="num">{formatTokens(usage.inputTokens)}</span> · ud <span className="num">{formatTokens(usage.outputTokens)}</span>
            {usage.reasoningTokens > 0 && <> (heraf tænkning <span className="num">{formatTokens(usage.reasoningTokens)}</span>)</>}
            {usage.calls > 1 && <> · {usage.calls} retninger</>}
          </p>
        </>
      ) : (
        <p>ca. <span className="num" title={formatUSD(cost)}>{formatKr(cost)}</span>. Tokens blev ikke registreret for denne retning.</p>
      )}
    </div>
  );
}

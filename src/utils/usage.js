/**
 * Hjælpere til tokenforbrug (rene funktioner, så de kan testes).
 */

/** OpenAI-usage → vores felter. */
export function normalizeUsage(usage) {
  return {
    inputTokens: Number(usage?.prompt_tokens) || 0,
    outputTokens: Number(usage?.completion_tokens) || 0,
    reasoningTokens: Number(usage?.completion_tokens_details?.reasoning_tokens) || 0,
    cachedTokens: Number(usage?.prompt_tokens_details?.cached_tokens) || 0
  };
}

const FELTER = ['calls', 'inputTokens', 'outputTokens', 'reasoningTokens', 'cachedTokens', 'cost'];

/** Læg forbrug sammen (manglende felter tæller som 0). */
export function addUsage(...list) {
  const out = Object.fromEntries(FELTER.map(f => [f, 0]));
  for (const u of list) {
    if (!u) continue;
    for (const f of FELTER) out[f] += Number(u[f]) || 0;
  }
  return out;
}

export const totalTokens = (u) => (Number(u?.inputTokens) || 0) + (Number(u?.outputTokens) || 0);

const nf = new Intl.NumberFormat('da-DK');
export const formatTokens = (n) => nf.format(Math.round(Number(n) || 0));

/** Kort form: 1.234 → "1,2 k", 2.500.000 → "2,5 mio." */
export function formatTokensKort(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return `${(v / 1e6).toLocaleString('da-DK', { maximumFractionDigits: 1 })} mio.`;
  if (v >= 1e3) return `${(v / 1e3).toLocaleString('da-DK', { maximumFractionDigits: 1 })} k`;
  return nf.format(Math.round(v));
}

export function formatUSD(n) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 3 : 2 });
}

/** Lokal dato som YYYY-MM-DD (bruges som dokument-id pr. dag). */
export function dagNoegle(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Anslået kurs til visning i kroner. Priserne i MODEL_PRICES er i USD. */
export const USD_TIL_DKK = 7;

export function formatKr(usd) {
  const kr = (Number(usd) || 0) * USD_TIL_DKK;
  return `${kr.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr.`;
}

/** Forbrug for én retning (nye resultater har `usage`, ældre kun `apiCost`). */
export function resultatForbrug(result) {
  const usage = result?.usage || result?.metadata?.usage || null;
  const cost = usage?.cost ?? result?.apiCost ?? result?.metadata?.cost ?? 0;
  return { usage, cost: Number(cost) || 0, harTokens: Boolean(usage && totalTokens(usage) > 0) };
}

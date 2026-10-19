/**
 * Klient til Netlify-funktionen grade-exam.
 * Klienten sender kun en opgavetype + data. Selve prompten bygges på serveren.
 */

const ENDPOINT = '/.netlify/functions/grade-exam';

/**
 * Priser pr. 1M tokens (USD), kun til omkostningsvisning i UI.
 * Ret her hvis I skifter model via OPENAI_MODEL på Netlify.
 */
export const MODEL_PRICES = {
  'gpt-6.1-sol': { input: 2, output: 10 },
  'gpt-6-astra': { input: 10, output: 50 },
  'gpt-6-luna': { input: 0.1, output: 0.5 },
  'gpt-4o': { input: 2.5, output: 10 },
  default: { input: 2, output: 10 }
};

export function calculateCost(usage, model) {
  if (!usage) return 0;
  const key = Object.keys(MODEL_PRICES).find(k => k !== 'default' && model?.startsWith(k));
  const price = MODEL_PRICES[key] || MODEL_PRICES.default;
  return (
    ((usage.prompt_tokens || 0) / 1e6) * price.input +
    ((usage.completion_tokens || 0) / 1e6) * price.output
  );
}

export class AIError extends Error {
  constructor(message, { status, retryable = false } = {}) {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.retryable = retryable;
    this.isTimeout = status === 504 || /i tide/.test(message);
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Kald grade-exam med automatisk genforsøg ved 429, 5xx og timeouts.
 * @param {string} task - 'gradeMath' | 'gradeDansk' | 'parseBedoemmelse' | 'explainTask' | 'askQuestion' | 'ping'
 * @param {Object} payload
 * @param {Object} [options]
 * @param {number} [options.timeoutMs=60000]
 * @param {number} [options.maxRetries=3]
 * @param {(info: {attempt:number, maxRetries:number, waitSeconds:number, reason:string}) => void} [options.onRetry]
 * @param {(secondsLeft:number) => void} [options.onWaitTick]
 * @returns {Promise<{ result: any, usage: Object|null, model: string, cost: number }>}
 */
export async function callAI(task, payload, options = {}) {
  const { timeoutMs = 60000, maxRetries = 3, onRetry, onWaitTick } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callOnce(task, payload, timeoutMs);
    } catch (err) {
      lastError = err;
      if (!(err instanceof AIError) || !err.retryable || attempt === maxRetries) throw err;
      // En timeout gentager sig typisk – prøv kun én gang mere
      if (err.isTimeout && attempt >= 1) throw err;

      // 429: vent længere. Andre fejl: kort backoff med lidt tilfældighed.
      const base = err.status === 429 ? 20 : 3;
      const waitSeconds = Math.min(base * Math.pow(2, attempt), 120) + Math.round(Math.random() * 2);
      onRetry?.({ attempt: attempt + 1, maxRetries, waitSeconds, reason: err.message });
      for (let s = waitSeconds; s > 0; s--) {
        onWaitTick?.(s);
        await sleep(1000);
      }
    }
  }
  throw lastError;
}

async function callOnce(task, payload, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, payload }),
      signal: controller.signal
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AIError('AI svarede ikke i tide', { retryable: true });
    }
    throw new AIError(`Netværksfejl: ${err.message}`, { retryable: true });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Netlify kan svare med HTML ved timeout (502/504)
  }

  if (!response.ok || !data?.success) {
    const status = response.status;
    const message =
      data?.error ||
      (status === 413 ? 'Forespørgslen er for stor (for mange/store billeder)' : `AI-fejl (${status})`);
    const retryable = status === 429 || status === 502 || status === 503 || status === 504;
    throw new AIError(message, { status, retryable });
  }

  return {
    result: data.result,
    usage: data.usage,
    model: data.model,
    cost: calculateCost(data.usage, data.model)
  };
}

// ==================== PSEUDONYMISERING ====================

/**
 * Udled elevens navn fra filnavn/submissionId, fx "12_Søren Hansen.pdf" → "Søren Hansen".
 */
export function navnFraFilnavn(fileName) {
  if (!fileName) return '';
  return String(fileName)
    .replace(/\.[^/.]+$/, '')
    .replace(/^\d+[_\s-]+/, '')
    .replace(/[_]+/g, ' ')
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Fjern elevens navn fra teksten, før den sendes til AI.
 * Erstatter fulde navn og hvert navneord (min. 3 bogstaver) med "[ELEV]".
 * @param {string} text
 * @param {string} elevNavn
 * @returns {string}
 */
export function fjernElevnavn(text, elevNavn) {
  if (!text || !elevNavn) return text;
  const fuldtNavn = elevNavn.trim();
  const dele = fuldtNavn.split(/\s+/).filter(d => d.length >= 3);
  const kandidater = [fuldtNavn, ...dele].filter(Boolean).sort((a, b) => b.length - a.length);

  let result = text;
  for (const navn of kandidater) {
    // Unicode-venlig ordgrænse (så "Hans" ikke rammer "Hansen")
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(navn)}(?![\\p{L}\\p{N}])`, 'giu');
    result = result.replace(re, '[ELEV]');
  }
  return result;
}

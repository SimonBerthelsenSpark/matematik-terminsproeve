/**
 * Klient til Netlify-funktionen grade-exam.
 * Klienten sender kun en opgavetype + data. Selve prompten bygges på serveren.
 */


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

/**
 * Registrering af forbrug sættes udefra (main.jsx), så denne fil ikke afhænger af Firebase.
 * @type {null | ((info: { task: string, examId?: string, model: string, usage: Object, cost: number }) => any)}
 */
let usageRecorder = null;
export function setUsageRecorder(fn) {
  usageRecorder = fn;
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

const START_ENDPOINT = '/.netlify/functions/grade-start';
const STATUS_ENDPOINT = '/.netlify/functions/grade-status';
const POLL_MS = 2500;
const JOB_TIMEOUT_MS = 15 * 60 * 1000;

// Igangværende job huskes i browseren, så et job kan hentes igen efter en genindlæsning.
// Serveren gemmer resultatet i ca. 16 minutter.
const RESUME_MAX_MS = 15 * 60 * 1000;
const jobKey = (k) => `aiJob:${k}`;

function loadJob(resumeKey) {
  if (!resumeKey) return null;
  try {
    const v = JSON.parse(localStorage.getItem(jobKey(resumeKey)) || 'null');
    if (v?.jobId && Date.now() - v.startedAt < RESUME_MAX_MS) return v;
    localStorage.removeItem(jobKey(resumeKey));
  } catch { /* ingen browser-lager */ }
  return null;
}
function saveJob(resumeKey, jobId) {
  if (!resumeKey) return;
  try { localStorage.setItem(jobKey(resumeKey), JSON.stringify({ jobId, startedAt: Date.now() })); } catch { /* ignorér */ }
}
function forgetJob(resumeKey) {
  if (!resumeKey) return;
  try { localStorage.removeItem(jobKey(resumeKey)); } catch { /* ignorér */ }
}

/**
 * Kør en AI-opgave som baggrundsjob og vent på resultatet.
 * Prøver automatisk igen ved 429, 5xx og netværksfejl.
 * @param {string} task - 'gradeMath' | 'gradeDansk' | 'parseBedoemmelse' | 'explainTask' | 'askQuestion' | 'ping'
 * @param {Object} payload
 * @param {Object} [options]
 * @param {number} [options.maxRetries=3]
 * @param {(info: {attempt:number, maxRetries:number, waitSeconds:number, reason:string}) => void} [options.onRetry]
 * @param {(secondsLeft:number) => void} [options.onWaitTick]
 * @param {(seconds:number) => void} [options.onProgress] - sekunder siden AI startede
 * @param {string} [options.examId] - prøven forbruget registreres på
 * @param {string} [options.resumeKey] - entydig nøgle for kaldet. Afbrydes siden, hentes det
 *   igangværende job igen ved næste kald med samme nøgle i stedet for at starte forfra.
 * @returns {Promise<{ result: any, usage: Object|null, model: string, cost: number }>}
 */
export async function callAI(task, payload, options = {}) {
  const { maxRetries = 3, onRetry, onWaitTick, onProgress, examId, resumeKey } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await runJob(task, payload, onProgress, resumeKey);
      forgetJob(resumeKey);
      try {
        Promise.resolve(usageRecorder?.({ task, examId, model: res.model, usage: res.usage, cost: res.cost }))
          .catch(err => console.warn('Forbrug kunne ikke registreres:', err?.message));
      } catch (err) {
        console.warn('Forbrug kunne ikke registreres:', err?.message);
      }
      return res;
    } catch (err) {
      lastError = err;
      forgetJob(resumeKey);
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

async function fetchJson(url, init) {
  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw new AIError(`Netværksfejl: ${err.message}`, { retryable: true });
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Netlify kan svare med HTML ved fejl
  }
  return { response, data };
}

function errorFrom(status, data) {
  const message =
    data?.error ||
    (status === 413 ? 'Forespørgslen er for stor (for mange/store billeder)' : `AI-fejl (${status})`);
  const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  return new AIError(message, { status, retryable });
}

async function runJob(task, payload, onProgress, resumeKey) {
  // 1) Start jobbet – eller fortsæt et job, der blev startet før en genindlæsning
  let jobId;
  let started = Date.now();
  const saved = loadJob(resumeKey);
  if (saved) {
    jobId = saved.jobId;
    started = saved.startedAt;
  } else {
    const { response, data } = await fetchJson(START_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, payload })
    });
    if (response.status !== 202 || !data?.jobId) throw errorFrom(response.status, data);
    jobId = data.jobId;
    saveJob(resumeKey, jobId);
  }

  // 2) Vent på resultatet
  while (Date.now() - started < JOB_TIMEOUT_MS) {
    await sleep(POLL_MS);
    onProgress?.(Math.round((Date.now() - started) / 1000));

    let r, status;
    try {
      ({ response: r, data: status } = await fetchJson(`${STATUS_ENDPOINT}?id=${encodeURIComponent(jobId)}`));
    } catch {
      // Netværket var væk et øjeblik – jobbet kører videre på serveren, så prøv igen ved næste poll
      continue;
    }
    if (r.status === 404) {
      throw new AIError('Resultatet gik tabt undervejs', { status: 404, retryable: true });
    }
    if (!r.ok || !status) {
      // Midlertidig fejl i statuskaldet – prøv igen ved næste poll
      continue;
    }
    if (status.state === 'done') {
      const out = status.response || {};
      return {
        result: out.result,
        usage: out.usage,
        model: out.model,
        cost: calculateCost(out.usage, out.model)
      };
    }
    if (status.state === 'error') {
      throw errorFrom(status.statusCode || 500, status.response);
    }
  }
  throw new AIError('AI svarede ikke i tide', { status: 504, retryable: true });
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

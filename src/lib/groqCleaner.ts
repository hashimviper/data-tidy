/**
 * Groq AI Data Cleaning Service
 * Uses Llama 3.3-70b-specdec for intelligent data transformation.
 * Implements batch processing, retry with backoff, and strict system instructions.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-specdec';
const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export interface GroqCleaningResult {
  data: Record<string, unknown>[];
  errorLog: GroqErrorEntry[];
  batchesProcessed: number;
  totalRows: number;
  failedRows: number;
}

export interface GroqErrorEntry {
  batchIndex: number;
  error: string;
  rowCount: number;
}

export type GroqProgressCallback = (info: {
  phase: 'sending' | 'retrying' | 'done' | 'error';
  batch: number;
  totalBatches: number;
  message: string;
}) => void;

function getApiKey(): string {
  const key = import.meta.env.VITE_GROQ_API_KEY;
  if (!key) {
    throw new Error('VITE_GROQ_API_KEY is not set. Add it to your environment variables.');
  }
  return key;
}

const SYSTEM_PROMPT = `You are a data cleaning engine. You receive a JSON array of objects (rows) and must return ONLY a valid JSON array with the following strict transformations applied:

1. HEADERS: Convert ALL keys to snake_case (lowercase, underscores for spaces/special chars).
2. NUMERICAL INTEGRITY: If a column represents age, keep it as an integer. Do NOT convert ages to birthdates.
3. FEATURE ENGINEERING: Add an "age_group" column based on the "age" (or equivalent) column:
   - Under 18
   - 18-25
   - 26-35
   - 36-45
   - 46-60
   - 60+
   If age is missing or invalid, set age_group to "Unknown".
4. NORMALIZATION:
   - Standardize "gender" values to Title Case (e.g., "Male", "Female", "Other", "Unknown").
   - Standardize "product_category" (or similar category columns) to Title Case.
   - Convert "discount_applied" (or equivalent boolean-like columns) to strictly "Yes" or "No".
5. MISSING VALUES: For non-inferable fields like gender or names, set missing values to "Unknown". Do NOT guess or infer.
6. FORMAT: Return ONLY a valid JSON array. No markdown, no explanation, no code fences. Just the raw JSON array.`;

async function callGroqWithRetry(
  batch: Record<string, unknown>[],
  batchIndex: number,
  totalBatches: number,
  onProgress?: GroqProgressCallback,
  retryCount = 0
): Promise<Record<string, unknown>[]> {
  const apiKey = getApiKey();

  onProgress?.({
    phase: retryCount > 0 ? 'retrying' : 'sending',
    batch: batchIndex + 1,
    totalBatches,
    message: retryCount > 0
      ? `Retrying batch ${batchIndex + 1}/${totalBatches} (attempt ${retryCount + 1})...`
      : `Processing batch ${batchIndex + 1}/${totalBatches}...`,
  });

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(batch) },
      ],
      temperature: 0,
      max_tokens: 8192,
    }),
  });

  if (response.status === 429) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * (retryCount + 1);
      onProgress?.({
        phase: 'retrying',
        batch: batchIndex + 1,
        totalBatches,
        message: `Rate limited. Retrying in ${delay / 1000}s...`,
      });
      await sleep(delay);
      return callGroqWithRetry(batch, batchIndex, totalBatches, onProgress, retryCount + 1);
    }
    throw new Error('RATE_LIMIT');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const content: string = json.choices?.[0]?.message?.content ?? '';

  // Strip potential markdown fences
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Response is not an array');
    return parsed;
  } catch {
    throw new Error(`Failed to parse Groq response as JSON: ${cleaned.slice(0, 200)}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean data using the Groq API with automatic batching.
 */
export async function cleanWithGroq(
  data: Record<string, unknown>[],
  onProgress?: GroqProgressCallback
): Promise<GroqCleaningResult> {
  if (data.length === 0) {
    return { data: [], errorLog: [], batchesProcessed: 0, totalRows: 0, failedRows: 0 };
  }

  const batches: Record<string, unknown>[][] = [];
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    batches.push(data.slice(i, i + BATCH_SIZE));
  }

  const allCleaned: Record<string, unknown>[] = [];
  const errorLog: GroqErrorEntry[] = [];
  let failedRows = 0;

  for (let i = 0; i < batches.length; i++) {
    try {
      const result = await callGroqWithRetry(batches[i], i, batches.length, onProgress);
      allCleaned.push(...result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errorLog.push({
        batchIndex: i,
        error: message,
        rowCount: batches[i].length,
      });
      failedRows += batches[i].length;
    }

    // Small delay between batches to respect rate limits
    if (i < batches.length - 1) {
      await sleep(1000);
    }
  }

  onProgress?.({
    phase: 'done',
    batch: batches.length,
    totalBatches: batches.length,
    message: 'AI cleaning complete!',
  });

  return {
    data: allCleaned,
    errorLog,
    batchesProcessed: batches.length,
    totalRows: data.length,
    failedRows,
  };
}

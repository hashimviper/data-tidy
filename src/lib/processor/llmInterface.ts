/**
 * Semantic LLM Cleaning Interface.
 * Calls Groq (or Google) only for rows needing fuzzy logic/categorization.
 * Uses LRU cache to avoid redundant API calls.
 */

import { LRUCache, hashRow } from './lruCache';
import { ProcessingLogger } from './logger';

type DataRow = Record<string, unknown>;

const BATCH_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

interface LLMConfig {
  apiKey: string;
  provider: 'groq' | 'google';
}

function getEndpoint(provider: 'groq' | 'google'): string {
  if (provider === 'google') {
    return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  }
  return 'https://api.groq.com/openai/v1/chat/completions';
}

function getModel(provider: 'groq' | 'google'): string {
  if (provider === 'google') return 'gemini-2.0-flash';
  return 'llama-3.3-70b-specdec';
}

const SYSTEM_PROMPT = `You are a data cleaning engine. You receive a JSON array of objects (rows) and must return ONLY a valid JSON array with these transformations:
1. HEADERS: Convert ALL keys to snake_case.
2. NUMERICAL INTEGRITY: Keep age as integer, never convert to birthdate.
3. FEATURE ENGINEERING: Add "age_group" column (Under 18, 18-25, 26-35, 36-45, 46-60, 60+). If age missing, set "Unknown".
4. NORMALIZATION: Gender → Title Case, categories → Title Case, booleans → "Yes"/"No".
5. MISSING VALUES: Set to "Unknown" for text, null for numbers. Do NOT guess.
6. FORMAT: Return ONLY valid JSON array. No markdown, no explanation.`;

export type LLMProgressCallback = (info: {
  phase: 'sending' | 'retrying' | 'done' | 'error';
  batch: number;
  totalBatches: number;
  message: string;
}) => void;

export interface LLMCleaningResult {
  data: DataRow[];
  cacheHits: number;
  apiCalls: number;
  failedRows: number;
  errors: { batch: number; error: string; rowCount: number }[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithRetry(
  batch: DataRow[],
  config: LLMConfig,
  batchIndex: number,
  totalBatches: number,
  onProgress?: LLMProgressCallback,
  retryCount = 0
): Promise<DataRow[]> {
  const endpoint = getEndpoint(config.provider);
  const model = getModel(config.provider);

  onProgress?.({
    phase: retryCount > 0 ? 'retrying' : 'sending',
    batch: batchIndex + 1,
    totalBatches,
    message: retryCount > 0
      ? `Retrying batch ${batchIndex + 1}/${totalBatches} (attempt ${retryCount + 1})...`
      : `Processing batch ${batchIndex + 1}/${totalBatches}...`,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
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
      return callWithRetry(batch, config, batchIndex, totalBatches, onProgress, retryCount + 1);
    }
    throw new Error('RATE_LIMIT');
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const content: string = json.choices?.[0]?.message?.content ?? '';
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Response is not an array');
    return parsed;
  } catch {
    throw new Error(`Failed to parse LLM response: ${cleaned.slice(0, 200)}`);
  }
}

/**
 * Determines which rows need LLM processing (fuzzy categorization, non-standard values).
 */
export function identifyRowsNeedingLLM(data: DataRow[]): { needsLLM: DataRow[]; clean: DataRow[]; needsLLMIndices: number[] } {
  const needsLLM: DataRow[] = [];
  const clean: DataRow[] = [];
  const needsLLMIndices: number[] = [];

  data.forEach((row, idx) => {
    const values = Object.values(row);
    const hasMessyData = values.some((v) => {
      if (v === null || v === undefined) return false;
      const s = String(v).trim();
      // Mixed case chaos, special chars, or ambiguous values
      if (/[^\w\s@.,\-/()#]/.test(s)) return true;
      // Very long free-text that may need categorization
      if (s.length > 100) return true;
      return false;
    });

    if (hasMessyData) {
      needsLLM.push(row);
      needsLLMIndices.push(idx);
    } else {
      clean.push(row);
    }
  });

  return { needsLLM, clean, needsLLMIndices };
}

/**
 * Clean data via LLM with caching.
 */
export async function cleanWithLLM(
  data: DataRow[],
  config: LLMConfig,
  logger: ProcessingLogger,
  onProgress?: LLMProgressCallback
): Promise<LLMCleaningResult> {
  const cache = new LRUCache<DataRow>(1000);
  let cacheHits = 0;
  let apiCalls = 0;
  const errors: LLMCleaningResult['errors'] = [];
  let failedRows = 0;

  // Check cache first
  const uncachedRows: DataRow[] = [];
  const uncachedIndices: number[] = [];
  const resultMap = new Map<number, DataRow>();

  data.forEach((row, idx) => {
    const key = hashRow(row);
    const cached = cache.get(key);
    if (cached) {
      resultMap.set(idx, cached);
      cacheHits++;
    } else {
      uncachedRows.push(row);
      uncachedIndices.push(idx);
    }
  });

  logger.log('info', 'llm', `Cache hits: ${cacheHits}, rows to process: ${uncachedRows.length}`);

  // Batch uncached rows
  const batches: DataRow[][] = [];
  for (let i = 0; i < uncachedRows.length; i += BATCH_SIZE) {
    batches.push(uncachedRows.slice(i, i + BATCH_SIZE));
  }

  let processedCount = 0;
  for (let i = 0; i < batches.length; i++) {
    try {
      const result = await callWithRetry(batches[i], config, i, batches.length, onProgress);
      apiCalls++;

      // Cache results and map back
      result.forEach((cleanedRow, j) => {
        const originalIdx = uncachedIndices[processedCount + j];
        const key = hashRow(batches[i][j]);
        cache.set(key, cleanedRow);
        resultMap.set(originalIdx, cleanedRow);
      });
      processedCount += batches[i].length;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ batch: i, error: message, rowCount: batches[i].length });
      failedRows += batches[i].length;
      logger.log('error', 'llm', `Batch ${i} failed: ${message}`);
      // Keep original rows for failed batches
      batches[i].forEach((row, j) => {
        resultMap.set(uncachedIndices[processedCount + j], row);
      });
      processedCount += batches[i].length;
    }

    if (i < batches.length - 1) await sleep(1000);
  }

  // Reconstruct ordered result
  const finalData: DataRow[] = [];
  for (let i = 0; i < data.length; i++) {
    finalData.push(resultMap.get(i) ?? data[i]);
  }

  onProgress?.({ phase: 'done', batch: batches.length, totalBatches: batches.length, message: 'AI cleaning complete!' });

  return { data: finalData, cacheHits, apiCalls, failedRows, errors };
}

/**
 * DataProcessor — Orchestrator class for the data cleaning pipeline.
 * Implements chunked processing, schema validation, contextual transforms,
 * optional LLM cleaning, and structured logging.
 */

import { ProcessingLogger } from './logger';
import { inferColumnDefs, buildRowSchema, validateRows, type RejectedRow, type ColumnDef } from './schemaValidator';
import { applyContextualTransformations, type ContextualReport } from '../contextualMatcher';
import { cleanWithLLM, identifyRowsNeedingLLM, type LLMCleaningResult, type LLMProgressCallback } from './llmInterface';
import { cleanDataAdvanced } from '../dataCleaner';
import { type CleaningConfig, type EnhancedCleaningResult } from '../dataTypes';

type DataRow = Record<string, unknown>;

const DEFAULT_CHUNK_SIZE = 1000;

export interface ProcessorConfig {
  cleaningConfig: CleaningConfig;
  chunkSize?: number;
  enableLLM?: boolean;
  llmProvider?: 'groq' | 'google';
  llmApiKey?: string;
  onLLMProgress?: LLMProgressCallback;
}

export interface ProcessorResult {
  cleanedData: DataRow[];
  enhancedResult: EnhancedCleaningResult;
  rejectedRows: RejectedRow[];
  contextualReport: ContextualReport;
  llmResult?: LLMCleaningResult;
  log: ReturnType<ProcessingLogger['getSummary']>;
  columnDefs: ColumnDef[];
}

export class DataProcessor {
  private logger: ProcessingLogger;
  private config: ProcessorConfig;

  constructor(config: ProcessorConfig) {
    this.config = config;
    this.logger = new ProcessingLogger();
  }

  async process(data: DataRow[]): Promise<ProcessorResult> {
    this.logger.start();

    if (data.length === 0) {
      this.logger.log('warn', 'processor', 'Empty dataset received');
      this.logger.stop();
      throw new Error('No data to process');
    }

    this.logger.log('info', 'processor', `Starting pipeline for ${data.length} rows`);

    // ── Phase 1: Chunked contextual transformation ──
    const chunkSize = this.config.chunkSize ?? DEFAULT_CHUNK_SIZE;
    const contextChunks = this.chunkArray(data, chunkSize);
    let allContextData: DataRow[] = [];
    let mergedReport: ContextualReport | null = null;

    this.logger.log('info', 'contextual', `Processing ${contextChunks.length} chunk(s) of ${chunkSize}`);

    for (let i = 0; i < contextChunks.length; i++) {
      const { data: chunkData, report } = applyContextualTransformations(contextChunks[i]);
      allContextData.push(...chunkData);
      this.logger.trackRows(chunkData.length);

      if (!mergedReport) {
        mergedReport = { ...report };
      } else {
        mergedReport.missingValuesNormalized += report.missingValuesNormalized;
        mergedReport.booleansNormalized += report.booleansNormalized;
        mergedReport.genderNormalized += report.genderNormalized;
        mergedReport.ageImputedCount += report.ageImputedCount;
        if (report.ageGroupCreated) mergedReport.ageGroupCreated = true;
        if (report.calculatedAgeCreated) mergedReport.calculatedAgeCreated = true;
        report.piiColumnsMasked.forEach((col) => {
          if (!mergedReport!.piiColumnsMasked.includes(col)) {
            mergedReport!.piiColumnsMasked.push(col);
          }
        });
      }

      this.logger.log('info', 'contextual', `Chunk ${i + 1}/${contextChunks.length} done`);
    }

    const contextualReport = mergedReport!;
    this.logger.log('info', 'contextual', `Contextual transforms complete. Measures: ${contextualReport.measuresDetected}, Dimensions: ${contextualReport.dimensionsDetected}`);

    // ── Phase 2: Schema validation (Zod) ──
    const columnDefs = inferColumnDefs(allContextData);
    const schema = buildRowSchema(columnDefs);
    const { validRows, rejectedRows } = validateRows<DataRow>(allContextData, schema);

    this.logger.log('info', 'validation', `Valid: ${validRows.length}, Rejected: ${rejectedRows.length}`);
    if (rejectedRows.length > 0) {
      this.logger.log('warn', 'validation', `${rejectedRows.length} rows failed schema validation`);
    }

    let dataToClean = validRows;

    // ── Phase 3: Optional LLM cleaning (only for rows that need it) ──
    let llmResult: LLMCleaningResult | undefined;

    if (this.config.enableLLM && this.config.llmApiKey) {
      this.logger.log('info', 'llm', 'LLM cleaning enabled, identifying rows needing semantic processing...');

      const { needsLLM, clean, needsLLMIndices } = identifyRowsNeedingLLM(dataToClean);
      this.logger.log('info', 'llm', `${needsLLM.length} rows need LLM, ${clean.length} rows are clean`);

      if (needsLLM.length > 0) {
        llmResult = await cleanWithLLM(
          needsLLM,
          { apiKey: this.config.llmApiKey, provider: this.config.llmProvider ?? 'groq' },
          this.logger,
          this.config.onLLMProgress
        );

        // Merge LLM-cleaned rows back
        const merged = [...dataToClean];
        let llmIdx = 0;
        for (const origIdx of needsLLMIndices) {
          if (llmIdx < llmResult.data.length) {
            merged[origIdx] = llmResult.data[llmIdx];
            llmIdx++;
          }
        }
        dataToClean = merged;

        this.logger.log('info', 'llm', `LLM cleaning done. Cache hits: ${llmResult.cacheHits}, API calls: ${llmResult.apiCalls}`);
      }
    }

    // ── Phase 4: Advanced structural cleaning ──
    this.logger.log('info', 'cleaning', 'Running advanced structural cleaning...');
    const enhancedResult = cleanDataAdvanced(dataToClean, this.config.cleaningConfig);

    this.logger.stop();

    return {
      cleanedData: enhancedResult.data || dataToClean,
      enhancedResult,
      rejectedRows,
      contextualReport,
      llmResult,
      log: this.logger.getSummary(),
      columnDefs,
    };
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}

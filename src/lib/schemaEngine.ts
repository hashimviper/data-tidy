// Production-Grade Schema Validation & Transformation Engine
// Features: Schema validation, fuzzy mapping, type enforcement, idempotency, quality summary

import { parseMultiFormatDate } from './dataAnalyzer';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TargetSchema {
  columns: SchemaColumn[];
}

export interface SchemaColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required?: boolean;
  aliases?: string[];  // Known alternative names
}

export interface MappingRequirement {
  sourceColumn: string;
  suggestedTarget: string | null;
  confidence: number;       // 0-100
  status: 'exact' | 'fuzzy' | 'unmatched';
}

export interface SchemaValidationResult {
  isValid: boolean;
  mappings: MappingRequirement[];
  unmappedSource: string[];   // Source columns with no match
  unmappedTarget: string[];   // Target columns with no source
  overallConfidence: number;  // Average mapping confidence
}

export interface ErrorLogEntry {
  rowIndex: number;
  column: string;
  originalValue: unknown;
  expectedType: string;
  reason: string;
}

export interface DataQualitySummary {
  rowsProcessed: number;
  rowsSucceeded: number;
  rowsFailed: number;
  failureReasons: Record<string, number>;  // reason → count
  mappingConfidenceScore: number;          // 0-100
  errorLog: ErrorLogEntry[];
  duplicatesSkipped: number;
  columnStats: Record<string, { valid: number; invalid: number; missing: number }>;
}

export interface TransformationResult {
  data: Record<string, unknown>[];
  errorRows: Record<string, unknown>[];
  qualitySummary: DataQualitySummary;
  appliedMappings: Record<string, string>;  // source → target
}

export interface ConfirmedMapping {
  [sourceColumn: string]: string;  // source → target name
}

// ─── Levenshtein Distance ────────────────────────────────────────────────────

export function levenshteinDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () => Array(lb + 1).fill(0));

  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[la][lb];
}

/** Normalized similarity 0-100 (100 = identical) */
export function stringSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 100;
  return Math.round((1 - levenshteinDistance(na, nb) / maxLen) * 100);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ─── Schema Validation ──────────────────────────────────────────────────────

export function validateSchema(
  sourceColumns: string[],
  targetSchema: TargetSchema
): SchemaValidationResult {
  const mappings: MappingRequirement[] = [];
  const matchedTargets = new Set<string>();

  for (const src of sourceColumns) {
    let bestTarget: string | null = null;
    let bestScore = 0;
    let bestStatus: MappingRequirement['status'] = 'unmatched';

    for (const tgt of targetSchema.columns) {
      // Check exact match (case-insensitive, stripped)
      if (normalize(src) === normalize(tgt.name)) {
        bestTarget = tgt.name;
        bestScore = 100;
        bestStatus = 'exact';
        break;
      }

      // Check known aliases
      if (tgt.aliases?.some(a => normalize(a) === normalize(src))) {
        bestTarget = tgt.name;
        bestScore = 95;
        bestStatus = 'exact';
        break;
      }

      // Fuzzy match
      const sim = stringSimilarity(src, tgt.name);
      // Also check aliases for fuzzy
      const aliasSims = (tgt.aliases || []).map(a => stringSimilarity(src, a));
      const maxAlias = aliasSims.length > 0 ? Math.max(...aliasSims) : 0;
      const finalSim = Math.max(sim, maxAlias);

      if (finalSim > bestScore && finalSim >= 50) {
        bestTarget = tgt.name;
        bestScore = finalSim;
        bestStatus = 'fuzzy';
      }
    }

    if (bestTarget) matchedTargets.add(bestTarget);

    mappings.push({
      sourceColumn: src,
      suggestedTarget: bestTarget,
      confidence: bestScore,
      status: bestStatus,
    });
  }

  const unmappedSource = mappings
    .filter(m => m.status === 'unmatched')
    .map(m => m.sourceColumn);

  const unmappedTarget = targetSchema.columns
    .filter(c => !matchedTargets.has(c.name))
    .map(c => c.name);

  const mapped = mappings.filter(m => m.status !== 'unmatched');
  const overallConfidence = mapped.length > 0
    ? Math.round(mapped.reduce((s, m) => s + m.confidence, 0) / mapped.length)
    : 0;

  return {
    isValid: unmappedTarget.filter(t =>
      targetSchema.columns.find(c => c.name === t)?.required
    ).length === 0,
    mappings,
    unmappedSource,
    unmappedTarget,
    overallConfidence,
  };
}

// ─── Type Enforcement ────────────────────────────────────────────────────────

function enforceType(
  value: unknown,
  expectedType: SchemaColumn['type']
): { value: unknown; valid: boolean; reason?: string } {
  if (value === null || value === undefined || value === '') {
    return { value: null, valid: true }; // Missing handled separately
  }

  switch (expectedType) {
    case 'number': {
      const str = String(value).replace(/,/g, '').trim();
      const num = Number(str);
      if (isNaN(num)) {
        return { value, valid: false, reason: `Cannot cast "${String(value).slice(0, 50)}" to number` };
      }
      return { value: num, valid: true };
    }

    case 'date': {
      const { date } = parseMultiFormatDate(value);
      if (!date) {
        return { value, valid: false, reason: `Cannot parse "${String(value).slice(0, 50)}" as date (tried ISO, US, EU formats)` };
      }
      return { value: date.toISOString().split('T')[0], valid: true };
    }

    case 'boolean': {
      const str = String(value).toLowerCase().trim();
      const trueVals = ['true', 'yes', '1', 'y', 't', 'on'];
      const falseVals = ['false', 'no', '0', 'n', 'f', 'off'];
      if (trueVals.includes(str)) return { value: true, valid: true };
      if (falseVals.includes(str)) return { value: false, valid: true };
      return { value, valid: false, reason: `Cannot cast "${String(value).slice(0, 50)}" to boolean` };
    }

    case 'string':
    default:
      return { value: String(value).trim(), valid: true };
  }
}

// ─── Idempotency (hash-based) ───────────────────────────────────────────────

function hashRow(row: Record<string, unknown>): string {
  // Deterministic JSON key ordering
  const keys = Object.keys(row).sort();
  return keys.map(k => `${k}:${row[k] === null || row[k] === undefined ? '' : String(row[k])}`).join('|');
}

// ─── Main Transformation Pipeline ───────────────────────────────────────────

export function transformData(
  data: Record<string, unknown>[],
  targetSchema: TargetSchema,
  confirmedMappings: ConfirmedMapping
): TransformationResult {
  const errorLog: ErrorLogEntry[] = [];
  const successRows: Record<string, unknown>[] = [];
  const errorRows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let duplicatesSkipped = 0;
  const failureReasons: Record<string, number> = {};
  const columnStats: Record<string, { valid: number; invalid: number; missing: number }> = {};

  // Build reverse mapping: sourceCol → targetCol
  const mappingEntries = Object.entries(confirmedMappings);

  // Init column stats
  for (const tgt of targetSchema.columns) {
    columnStats[tgt.name] = { valid: 0, invalid: 0, missing: 0 };
  }

  for (let i = 0; i < data.length; i++) {
    const srcRow = data[i];

    // Idempotency: skip exact duplicate rows
    const hash = hashRow(srcRow);
    if (seen.has(hash)) {
      duplicatesSkipped++;
      continue;
    }
    seen.add(hash);

    const targetRow: Record<string, unknown> = {};
    let rowHasError = false;
    const rowErrors: ErrorLogEntry[] = [];

    for (const [srcCol, tgtCol] of mappingEntries) {
      const schemaCol = targetSchema.columns.find(c => c.name === tgtCol);
      const rawValue = srcRow[srcCol];

      if (!schemaCol) {
        // Extra column not in schema — pass through as-is
        targetRow[tgtCol] = rawValue;
        continue;
      }

      if (rawValue === null || rawValue === undefined || rawValue === '') {
        targetRow[tgtCol] = null;
        columnStats[tgtCol].missing++;
        continue;
      }

      const { value, valid, reason } = enforceType(rawValue, schemaCol.type);

      if (valid) {
        targetRow[tgtCol] = value;
        columnStats[tgtCol].valid++;
      } else {
        // Type enforcement failed — log error, move row to error log
        rowHasError = true;
        const errorReason = reason || `Type mismatch: expected ${schemaCol.type}`;
        rowErrors.push({
          rowIndex: i,
          column: tgtCol,
          originalValue: rawValue,
          expectedType: schemaCol.type,
          reason: errorReason,
        });
        columnStats[tgtCol].invalid++;
        failureReasons[errorReason] = (failureReasons[errorReason] || 0) + 1;
        targetRow[tgtCol] = rawValue; // Keep original in error row
      }
    }

    if (rowHasError) {
      targetRow['_error_details'] = rowErrors.map(e => e.reason).join('; ');
      errorRows.push(targetRow);
      errorLog.push(...rowErrors);
    } else {
      successRows.push(targetRow);
    }
  }

  const totalProcessed = data.length - duplicatesSkipped;
  const mappedCount = mappingEntries.length;
  const schemaCount = targetSchema.columns.length;
  const mappingConfidenceScore = schemaCount > 0
    ? Math.round((mappedCount / schemaCount) * 100)
    : 100;

  return {
    data: successRows,
    errorRows,
    qualitySummary: {
      rowsProcessed: totalProcessed,
      rowsSucceeded: successRows.length,
      rowsFailed: errorRows.length,
      failureReasons,
      mappingConfidenceScore,
      errorLog,
      duplicatesSkipped,
      columnStats,
    },
    appliedMappings: confirmedMappings,
  };
}

// ─── Auto-generate target schema from data (when no schema provided) ────────

export function inferSchemaFromData(data: Record<string, unknown>[]): TargetSchema {
  if (data.length === 0) return { columns: [] };

  const columns: SchemaColumn[] = [];
  const keys = Object.keys(data[0]);

  for (const key of keys) {
    const sample = data.slice(0, 100).map(r => r[key]).filter(v => v !== null && v !== undefined && v !== '');

    let type: SchemaColumn['type'] = 'string';

    // Check numeric
    const numCount = sample.filter(v => !isNaN(Number(String(v).replace(/,/g, '')))).length;
    if (numCount / Math.max(sample.length, 1) > 0.85) {
      type = 'number';
    } else {
      // Check date
      const dateCount = sample.filter(v => {
        const { date } = parseMultiFormatDate(v);
        return date !== null;
      }).length;
      if (dateCount / Math.max(sample.length, 1) > 0.7) {
        type = 'date';
      } else {
        // Check boolean
        const boolVals = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];
        const boolCount = sample.filter(v => boolVals.includes(String(v).toLowerCase().trim())).length;
        if (boolCount === sample.length && sample.length >= 2) {
          type = 'boolean';
        }
      }
    }

    columns.push({ name: key, type, required: false });
  }

  return { columns };
}

// ─── Convenience: full pipeline with auto-schema ─────────────────────────────

export function autoTransform(
  data: Record<string, unknown>[],
  targetSchema?: TargetSchema
): {
  validationResult: SchemaValidationResult;
  transformationResult: TransformationResult | null;
  schema: TargetSchema;
} {
  if (data.length === 0) {
    const emptySchema: TargetSchema = { columns: [] };
    return {
      validationResult: { isValid: true, mappings: [], unmappedSource: [], unmappedTarget: [], overallConfidence: 100 },
      transformationResult: { data: [], errorRows: [], qualitySummary: { rowsProcessed: 0, rowsSucceeded: 0, rowsFailed: 0, failureReasons: {}, mappingConfidenceScore: 100, errorLog: [], duplicatesSkipped: 0, columnStats: {} }, appliedMappings: {} },
      schema: emptySchema,
    };
  }

  const schema = targetSchema || inferSchemaFromData(data);
  const sourceColumns = Object.keys(data[0]);
  const validationResult = validateSchema(sourceColumns, schema);

  // Auto-confirm mappings where confidence >= 50
  const confirmedMappings: ConfirmedMapping = {};
  for (const m of validationResult.mappings) {
    if (m.suggestedTarget && m.confidence >= 50) {
      confirmedMappings[m.sourceColumn] = m.suggestedTarget;
    }
  }

  // Include unmapped source columns as pass-through
  for (const src of sourceColumns) {
    if (!confirmedMappings[src]) {
      confirmedMappings[src] = src;
    }
  }

  const transformationResult = transformData(data, schema, confirmedMappings);

  return { validationResult, transformationResult, schema };
}

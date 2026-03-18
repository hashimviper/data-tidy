/**
 * AI Dataset Analyzer
 * Sends schema + sample rows to LLM, returns structured column analysis.
 * Uses existing VITE_GOOGLE_API_KEY or VITE_GROQ_API_KEY.
 */

type DataRow = Record<string, unknown>;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ColumnIssue {
  type: 'missing_values' | 'string_format' | 'inconsistent_format' | 'outliers' | 'duplicates' | 'mixed_types' | 'invalid_values';
  description: string;
  severity: 'low' | 'medium' | 'high';
  affectedCount?: number;
  affectedPercent?: number;
}

export interface SuggestedFix {
  id: string;
  action: string;
  description: string;
  column: string;
  enabled: boolean; // default true, user can toggle off
}

export interface ColumnAnalysis {
  name: string;
  detected_type: string;
  issues: ColumnIssue[];
  suggested_fixes: SuggestedFix[];
  quality_score: number; // 0-100
  sample_values: string[];
  missing_percent: number;
  unique_count: number;
}

export interface DatasetAnalysis {
  columns: ColumnAnalysis[];
  overall_quality_score: number;
  total_rows: number;
  total_issues: number;
  summary: string;
}

// ─── Local Analysis (no API needed) ──────────────────────────────────────────

function analyzeColumnLocally(name: string, values: unknown[]): Omit<ColumnAnalysis, 'suggested_fixes'> & { suggested_fixes: Omit<SuggestedFix, 'id'>[] } {
  const total = values.length;
  const missing = values.filter(v => v === null || v === undefined || String(v).trim() === '' || String(v).trim().toLowerCase() === 'nan').length;
  const missingPercent = total > 0 ? (missing / total) * 100 : 0;
  const nonEmpty = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  const strValues = nonEmpty.map(v => String(v).trim());
  const uniqueValues = new Set(strValues);
  const uniqueCount = uniqueValues.size;

  // Type detection
  const numericCount = strValues.filter(v => /^-?\d+(\.\d+)?$/.test(v.replace(/,/g, ''))).length;
  const dateCount = strValues.filter(v => !isNaN(Date.parse(v)) && v.length > 4).length;
  const boolCount = strValues.filter(v => ['true', 'false', 'yes', 'no', '1', '0', 't', 'f', 'y', 'n'].includes(v.toLowerCase())).length;

  let detected_type = 'text';
  if (numericCount / Math.max(strValues.length, 1) > 0.8) detected_type = 'numeric';
  else if (dateCount / Math.max(strValues.length, 1) > 0.6) detected_type = 'date';
  else if (boolCount === strValues.length && strValues.length > 0) detected_type = 'boolean';
  else if (uniqueCount <= Math.min(20, total * 0.3) && strValues.length > 0) detected_type = 'categorical';

  const issues: ColumnIssue[] = [];
  const suggested_fixes: Omit<SuggestedFix, 'id'>[] = [];

  // Missing values
  if (missingPercent > 0) {
    issues.push({
      type: 'missing_values',
      description: `${missing} missing values (${missingPercent.toFixed(1)}%)`,
      severity: missingPercent > 30 ? 'high' : missingPercent > 10 ? 'medium' : 'low',
      affectedCount: missing,
      affectedPercent: missingPercent,
    });
    if (detected_type === 'numeric') {
      suggested_fixes.push({ action: 'fill_missing_with_median', description: `Fill ${missing} missing values with median`, column: name, enabled: true });
    } else {
      suggested_fixes.push({ action: 'fill_missing_with_unknown', description: `Fill ${missing} missing values with "Unknown"`, column: name, enabled: true });
    }
  }

  // Mixed types in numeric columns
  if (detected_type === 'numeric' && numericCount < strValues.length) {
    const nonNumeric = strValues.length - numericCount;
    issues.push({
      type: 'mixed_types',
      description: `${nonNumeric} non-numeric values in numeric column`,
      severity: 'high',
      affectedCount: nonNumeric,
    });
    suggested_fixes.push({ action: 'convert_to_number', description: `Convert ${nonNumeric} string values to numbers`, column: name, enabled: true });
  }

  // Inconsistent formatting in text
  if (detected_type === 'text' || detected_type === 'categorical') {
    const hasMixedCase = strValues.some(v => v !== v.toLowerCase() && v !== v.toUpperCase() && v !== titleCase(v));
    const hasLeadingTrailingSpaces = strValues.some(v => v !== v.trim());
    if (hasMixedCase && uniqueCount < total * 0.5) {
      issues.push({
        type: 'inconsistent_format',
        description: 'Inconsistent casing detected',
        severity: 'medium',
      });
      suggested_fixes.push({ action: 'standardize_case', description: 'Standardize to Title Case', column: name, enabled: true });
    }
    if (hasLeadingTrailingSpaces) {
      issues.push({
        type: 'inconsistent_format',
        description: 'Leading/trailing whitespace detected',
        severity: 'low',
      });
      suggested_fixes.push({ action: 'trim_whitespace', description: 'Trim whitespace from values', column: name, enabled: true });
    }
  }

  // Inconsistent date formats
  if (detected_type === 'date') {
    const formats = new Set<string>();
    strValues.forEach(v => {
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) formats.add('YYYY-MM-DD');
      else if (/^\d{2}\/\d{2}\/\d{4}/.test(v)) formats.add('MM/DD/YYYY');
      else if (/^\d{2}-\d{2}-\d{4}/.test(v)) formats.add('DD-MM-YYYY');
      else formats.add('other');
    });
    if (formats.size > 1) {
      issues.push({
        type: 'inconsistent_format',
        description: `Mixed date formats detected: ${[...formats].join(', ')}`,
        severity: 'high',
      });
      suggested_fixes.push({ action: 'normalize_dates', description: 'Normalize all dates to YYYY-MM-DD', column: name, enabled: true });
    }
  }

  // Outliers for numeric columns
  if (detected_type === 'numeric' && numericCount > 5) {
    const nums = strValues.map(v => parseFloat(v.replace(/,/g, ''))).filter(n => !isNaN(n));
    const sorted = [...nums].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const outlierCount = nums.filter(n => n < lower || n > upper).length;
    if (outlierCount > 0) {
      issues.push({
        type: 'outliers',
        description: `${outlierCount} outlier(s) detected outside IQR bounds`,
        severity: outlierCount > nums.length * 0.1 ? 'high' : 'medium',
        affectedCount: outlierCount,
      });
      suggested_fixes.push({ action: 'cap_outliers', description: `Cap ${outlierCount} outliers to IQR bounds`, column: name, enabled: true });
    }
  }

  // Quality score
  let quality = 100;
  quality -= missingPercent * 0.5;
  issues.forEach(i => {
    if (i.severity === 'high') quality -= 15;
    else if (i.severity === 'medium') quality -= 8;
    else quality -= 3;
  });
  quality = Math.max(0, Math.min(100, Math.round(quality)));

  const sampleSlice = strValues.slice(0, 5);

  return {
    name,
    detected_type,
    issues,
    suggested_fixes,
    quality_score: quality,
    sample_values: sampleSlice,
    missing_percent: Math.round(missingPercent * 10) / 10,
    unique_count: uniqueCount,
  };
}

function titleCase(str: string): string {
  return str.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ─── AI-Enhanced Analysis ────────────────────────────────────────────────────

const AI_ANALYSIS_PROMPT = `You are a data quality expert. Analyze the following dataset schema and sample data.
Return ONLY a valid JSON object with this structure:
{
  "column_insights": [
    {
      "name": "column_name",
      "detected_type": "numeric|text|date|boolean|categorical",
      "issues": ["issue description"],
      "suggested_actions": ["action description"],
      "quality_note": "brief quality assessment"
    }
  ],
  "overall_summary": "brief dataset quality summary",
  "critical_issues": ["most important issues to fix first"]
}
Do NOT include markdown formatting. Return ONLY the JSON.`;

interface AIEnhancement {
  column_insights: { name: string; quality_note: string; issues: string[]; suggested_actions: string[] }[];
  overall_summary: string;
  critical_issues: string[];
}

function getLLMConfig() {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  const googleKey = import.meta.env.VITE_GOOGLE_API_KEY;
  if (groqKey) return { apiKey: groqKey, provider: 'groq' as const };
  if (googleKey) return { apiKey: googleKey, provider: 'google' as const };
  return null;
}

function getEndpoint(provider: 'groq' | 'google'): string {
  if (provider === 'google') return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
  return 'https://api.groq.com/openai/v1/chat/completions';
}

function getModel(provider: 'groq' | 'google'): string {
  if (provider === 'google') return 'gemini-2.0-flash';
  return 'llama-3.3-70b-specdec';
}

async function fetchAIEnhancement(data: DataRow[]): Promise<AIEnhancement | null> {
  const config = getLLMConfig();
  if (!config) return null;

  const columns = Object.keys(data[0] || {});
  const sample = data.slice(0, 15).map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach(c => { obj[c] = row[c]; });
    return obj;
  });

  const prompt = `Dataset has ${data.length} rows and ${columns.length} columns.
Columns: ${columns.join(', ')}
Sample data (first 15 rows):
${JSON.stringify(sample, null, 1)}`;

  try {
    const response = await fetch(getEndpoint(config.provider), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: getModel(config.provider),
        messages: [
          { role: 'system', content: AI_ANALYSIS_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) return null;

    const json = await response.json();
    const content: string = json.choices?.[0]?.message?.content ?? '';
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned) as AIEnhancement;
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type AnalysisProgress = (info: { phase: 'local' | 'ai' | 'done' | 'error'; message: string }) => void;

export async function analyzeDataset(
  data: DataRow[],
  onProgress?: AnalysisProgress
): Promise<DatasetAnalysis> {
  if (data.length === 0) {
    return { columns: [], overall_quality_score: 0, total_rows: 0, total_issues: 0, summary: 'Empty dataset' };
  }

  onProgress?.({ phase: 'local', message: 'Analyzing column types and data quality...' });

  const columns = Object.keys(data[0]);
  let fixIdCounter = 0;

  // Local analysis
  const localResults = columns.map(col => {
    const values = data.map(row => row[col]);
    const result = analyzeColumnLocally(col, values);
    return {
      ...result,
      suggested_fixes: result.suggested_fixes.map(f => ({
        ...f,
        id: `fix_${fixIdCounter++}`,
      })),
    };
  });

  // AI enhancement
  onProgress?.({ phase: 'ai', message: 'AI is analyzing your dataset for deeper insights...' });
  const aiResult = await fetchAIEnhancement(data);

  // Merge AI insights into local results
  if (aiResult) {
    for (const insight of aiResult.column_insights) {
      const local = localResults.find(c => c.name.toLowerCase() === insight.name.toLowerCase());
      if (!local) continue;

      // Add any new issues from AI that local didn't catch
      for (const issueDesc of insight.issues) {
        const alreadyExists = local.issues.some(i => i.description.toLowerCase().includes(issueDesc.toLowerCase().slice(0, 20)));
        if (!alreadyExists) {
          local.issues.push({
            type: 'invalid_values',
            description: issueDesc,
            severity: 'medium',
          });
        }
      }

      // Add AI-suggested actions not already present
      for (const action of insight.suggested_actions) {
        const alreadyExists = local.suggested_fixes.some(f => f.description.toLowerCase().includes(action.toLowerCase().slice(0, 20)));
        if (!alreadyExists) {
          local.suggested_fixes.push({
            id: `fix_${fixIdCounter++}`,
            action: 'ai_suggested',
            description: action,
            column: local.name,
            enabled: true,
          });
        }
      }
    }
  }

  const totalIssues = localResults.reduce((sum, c) => sum + c.issues.length, 0);
  const avgQuality = localResults.length > 0
    ? Math.round(localResults.reduce((sum, c) => sum + c.quality_score, 0) / localResults.length)
    : 100;

  const summary = aiResult?.overall_summary
    ?? `Dataset has ${data.length} rows across ${columns.length} columns with ${totalIssues} issue(s) detected. Overall quality: ${avgQuality}/100.`;

  onProgress?.({ phase: 'done', message: 'Analysis complete!' });

  return {
    columns: localResults,
    overall_quality_score: avgQuality,
    total_rows: data.length,
    total_issues: totalIssues,
    summary,
  };
}

// ─── Apply Fixes ─────────────────────────────────────────────────────────────

export function applySelectedFixes(data: DataRow[], fixes: SuggestedFix[]): DataRow[] {
  const enabledFixes = fixes.filter(f => f.enabled);
  if (enabledFixes.length === 0) return data;

  const result = data.map(row => ({ ...row }));
  const columns = Object.keys(result[0] || {});

  // Group fixes by column
  const fixesByColumn = new Map<string, SuggestedFix[]>();
  for (const fix of enabledFixes) {
    const list = fixesByColumn.get(fix.column) || [];
    list.push(fix);
    fixesByColumn.set(fix.column, list);
  }

  for (const [col, colFixes] of fixesByColumn) {
    if (!columns.includes(col)) continue;

    for (const fix of colFixes) {
      switch (fix.action) {
        case 'fill_missing_with_median': {
          const nums = result.map(r => r[col]).filter(v => v !== null && v !== undefined && String(v).trim() !== '').map(v => parseFloat(String(v).replace(/,/g, ''))).filter(n => !isNaN(n));
          if (nums.length === 0) break;
          const sorted = [...nums].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
          for (const row of result) {
            const v = row[col];
            if (v === null || v === undefined || String(v).trim() === '' || String(v).trim().toLowerCase() === 'nan') {
              row[col] = Math.round(median * 100) / 100;
            }
          }
          break;
        }
        case 'fill_missing_with_unknown': {
          for (const row of result) {
            const v = row[col];
            if (v === null || v === undefined || String(v).trim() === '' || String(v).trim().toLowerCase() === 'nan') {
              row[col] = 'Unknown';
            }
          }
          break;
        }
        case 'convert_to_number': {
          for (const row of result) {
            const v = row[col];
            if (v !== null && v !== undefined) {
              const num = parseFloat(String(v).replace(/[,$]/g, ''));
              if (!isNaN(num)) row[col] = num;
            }
          }
          break;
        }
        case 'standardize_case': {
          for (const row of result) {
            const v = row[col];
            if (typeof v === 'string') {
              row[col] = titleCase(v);
            }
          }
          break;
        }
        case 'trim_whitespace': {
          for (const row of result) {
            if (typeof row[col] === 'string') {
              row[col] = (row[col] as string).trim();
            }
          }
          break;
        }
        case 'normalize_dates': {
          for (const row of result) {
            const v = row[col];
            if (v !== null && v !== undefined && String(v).trim() !== '') {
              const d = new Date(String(v));
              if (!isNaN(d.getTime())) {
                row[col] = d.toISOString().split('T')[0];
              }
            }
          }
          break;
        }
        case 'cap_outliers': {
          const nums = result.map(r => r[col]).filter(v => v !== null && v !== undefined && String(v).trim() !== '').map(v => parseFloat(String(v).replace(/,/g, ''))).filter(n => !isNaN(n));
          if (nums.length < 5) break;
          const sorted = [...nums].sort((a, b) => a - b);
          const q1 = sorted[Math.floor(sorted.length * 0.25)];
          const q3 = sorted[Math.floor(sorted.length * 0.75)];
          const iqr = q3 - q1;
          const lower = q1 - 1.5 * iqr;
          const upper = q3 + 1.5 * iqr;
          for (const row of result) {
            const v = row[col];
            if (v !== null && v !== undefined) {
              const num = parseFloat(String(v).replace(/,/g, ''));
              if (!isNaN(num)) {
                if (num < lower) row[col] = Math.round(lower * 100) / 100;
                else if (num > upper) row[col] = Math.round(upper * 100) / 100;
              }
            }
          }
          break;
        }
        default:
          // AI-suggested or unknown actions — skip gracefully
          break;
      }
    }
  }

  return result;
}

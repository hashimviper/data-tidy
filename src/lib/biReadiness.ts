/**
 * BI-Readiness Validation Engine
 * Implements the 5 Pillars of Data Integrity:
 * 1. Accuracy — spot-check sample values against domain rules
 * 2. Completeness — detect gaps in timelines, missing columns, missing rows
 * 3. Consistency — cross-field logic, referential integrity, currency/unit mixing
 * 4. Timeliness — data freshness checks
 * 5. Validity — regex/format validation, encoding checks
 *
 * Also implements:
 * - Ghost data detection (whitespace, hidden chars)
 * - Domain constraint validation (temporal logic, range checks)
 * - Reconciliation audit (row-count ledger, distribution shift, edge-case sampling)
 */

type DataRow = Record<string, unknown>;

// ─── Types ───────────────────────────────────────────────────────────────────

export type PillarStatus = 'pass' | 'warn' | 'fail';

export interface PillarResult {
  name: string;
  status: PillarStatus;
  score: number; // 0-100
  checks: PillarCheck[];
  summary: string;
}

export interface PillarCheck {
  name: string;
  passed: boolean;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  details?: string[];
  affectedCount?: number;
}

export interface DomainViolation {
  rowIndex: number;
  rule: string;
  columns: string[];
  description: string;
}

export interface ReconciliationAudit {
  rowCountBefore: number;
  rowCountAfter: number;
  rowsDropped: number;
  dropReasons: { reason: string; count: number }[];
  distributionShifts: DistributionShift[];
  edgeCaseSamples: EdgeCaseSample[];
  schemaChanges: SchemaChange[];
}

export interface DistributionShift {
  column: string;
  meanBefore: number;
  meanAfter: number;
  stdDevBefore: number;
  stdDevAfter: number;
  shiftPercent: number;
  isSignificant: boolean;
}

export interface EdgeCaseSample {
  position: string; // 'first_5', 'last_5', 'random_10'
  rows: DataRow[];
}

export interface SchemaChange {
  type: 'renamed' | 'added' | 'removed' | 'type_changed';
  column: string;
  detail: string;
}

export interface GhostDataResult {
  column: string;
  leadingSpaces: number;
  trailingSpaces: number;
  hiddenChars: number;
  tabChars: number;
  newlineChars: number;
  totalAffected: number;
}

export interface BIReadinessReport {
  overallScore: number;
  overallStatus: PillarStatus;
  isReady: boolean;
  pillars: PillarResult[];
  domainViolations: DomainViolation[];
  ghostData: GhostDataResult[];
  reconciliation: ReconciliationAudit | null;
  timestamp: string;
  recommendations: string[];
}

// ─── Ghost Data Detection ────────────────────────────────────────────────────

export function detectGhostData(data: DataRow[]): GhostDataResult[] {
  if (data.length === 0) return [];
  const columns = Object.keys(data[0]);
  const results: GhostDataResult[] = [];

  for (const col of columns) {
    let leading = 0, trailing = 0, hidden = 0, tabs = 0, newlines = 0;

    for (const row of data) {
      const val = row[col];
      if (typeof val !== 'string') continue;
      if (val !== val.trimStart()) leading++;
      if (val !== val.trimEnd()) trailing++;
      if (/\t/.test(val)) tabs++;
      if (/[\r\n]/.test(val)) newlines++;
      // eslint-disable-next-line no-control-regex
      if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(val)) hidden++;
    }

    const total = leading + trailing + hidden + tabs + newlines;
    if (total > 0) {
      results.push({ column: col, leadingSpaces: leading, trailingSpaces: trailing, hiddenChars: hidden, tabChars: tabs, newlineChars: newlines, totalAffected: total });
    }
  }
  return results;
}

// ─── Domain Constraint Validation ────────────────────────────────────────────

function findColumnByPattern(columns: string[], patterns: string[]): string | null {
  for (const col of columns) {
    const lower = col.toLowerCase().replace(/[^a-z0-9]/g, '_');
    for (const p of patterns) {
      if (lower.includes(p)) return col;
    }
  }
  return null;
}

export function validateDomainConstraints(data: DataRow[]): DomainViolation[] {
  if (data.length === 0) return [];
  const columns = Object.keys(data[0]);
  const violations: DomainViolation[] = [];

  // Find relevant columns
  const orderDate = findColumnByPattern(columns, ['order_date', 'purchase_date', 'created']);
  const deliveryDate = findColumnByPattern(columns, ['delivery_date', 'ship_date', 'shipped_date', 'delivered']);
  const birthDate = findColumnByPattern(columns, ['date_of_birth', 'dob', 'birth_date']);
  const ageCol = findColumnByPattern(columns, ['age', 'customer_age', 'employee_age']);
  const priceCol = findColumnByPattern(columns, ['price', 'total_price', 'amount', 'total', 'revenue']);
  const discountCol = findColumnByPattern(columns, ['discount', 'discount_amount', 'discount_percent']);
  const quantityCol = findColumnByPattern(columns, ['quantity', 'qty']);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    // Temporal logic: delivery cannot precede order
    if (orderDate && deliveryDate) {
      const od = new Date(String(row[orderDate] || ''));
      const dd = new Date(String(row[deliveryDate] || ''));
      if (!isNaN(od.getTime()) && !isNaN(dd.getTime()) && dd < od) {
        violations.push({ rowIndex: i, rule: 'temporal_logic', columns: [orderDate, deliveryDate], description: `Delivery date (${dd.toISOString().split('T')[0]}) is before order date (${od.toISOString().split('T')[0]})` });
      }
    }

    // Age range: cannot be negative or > 130
    if (ageCol) {
      const age = Number(row[ageCol]);
      if (!isNaN(age) && (age < 0 || age > 130)) {
        violations.push({ rowIndex: i, rule: 'range_constraint', columns: [ageCol], description: `Age value ${age} is outside valid range (0-130)` });
      }
    }

    // Price: cannot be negative (unless refund column exists)
    if (priceCol) {
      const price = Number(row[priceCol]);
      if (!isNaN(price) && price < 0) {
        violations.push({ rowIndex: i, rule: 'range_constraint', columns: [priceCol], description: `Negative price: ${price}` });
      }
    }

    // Discount cannot exceed total price
    if (discountCol && priceCol) {
      const disc = Number(row[discountCol]);
      const price = Number(row[priceCol]);
      if (!isNaN(disc) && !isNaN(price) && disc > price && price > 0) {
        violations.push({ rowIndex: i, rule: 'logical_constraint', columns: [discountCol, priceCol], description: `Discount (${disc}) exceeds price (${price})` });
      }
    }

    // Quantity should be positive integer
    if (quantityCol) {
      const qty = Number(row[quantityCol]);
      if (!isNaN(qty) && (qty < 0 || qty !== Math.floor(qty))) {
        violations.push({ rowIndex: i, rule: 'range_constraint', columns: [quantityCol], description: `Invalid quantity: ${qty} (expected positive integer)` });
      }
    }
  }

  // Cap violations at 500 to prevent UI overload
  return violations.slice(0, 500);
}

// ─── 5 Pillars of BI-Readiness ───────────────────────────────────────────────

function checkAccuracy(data: DataRow[], columns: string[]): PillarResult {
  const checks: PillarCheck[] = [];

  // Check for negative values in typically-positive columns
  const positivePatterns = ['price', 'amount', 'total', 'revenue', 'cost', 'salary', 'quantity', 'count'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (!positivePatterns.some(p => lower.includes(p))) continue;
    const negatives = data.filter(r => { const v = Number(r[col]); return !isNaN(v) && v < 0; }).length;
    checks.push({
      name: `No negative values in ${col}`,
      passed: negatives === 0,
      severity: negatives > 0 ? 'warning' : 'info',
      message: negatives > 0 ? `${negatives} negative value(s) in "${col}"` : `"${col}" has no negative values`,
      affectedCount: negatives,
    });
  }

  // Check for impossible percentages
  const pctPatterns = ['percent', 'pct', 'rate', 'ratio'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (!pctPatterns.some(p => lower.includes(p))) continue;
    const outOfRange = data.filter(r => { const v = Number(r[col]); return !isNaN(v) && (v < 0 || v > 100); }).length;
    checks.push({
      name: `Valid percentage range in ${col}`,
      passed: outOfRange === 0,
      severity: outOfRange > 0 ? 'warning' : 'info',
      message: outOfRange > 0 ? `${outOfRange} value(s) outside 0-100 range` : 'All percentage values in valid range',
      affectedCount: outOfRange,
    });
  }

  if (checks.length === 0) {
    checks.push({ name: 'Domain accuracy', passed: true, severity: 'info', message: 'No domain-specific accuracy issues detected' });
  }

  const score = checks.length > 0 ? Math.round((checks.filter(c => c.passed).length / checks.length) * 100) : 100;
  return { name: 'Accuracy', status: score >= 90 ? 'pass' : score >= 60 ? 'warn' : 'fail', score, checks, summary: `${checks.filter(c => c.passed).length}/${checks.length} accuracy checks passed` };
}

function checkCompleteness(data: DataRow[], columns: string[]): PillarResult {
  const checks: PillarCheck[] = [];
  const totalCells = data.length * columns.length;
  let totalMissing = 0;

  // Per-column completeness
  for (const col of columns) {
    const missing = data.filter(r => {
      const v = r[col];
      return v === null || v === undefined || String(v).trim() === '' || String(v).trim().toLowerCase() === 'nan';
    }).length;
    totalMissing += missing;
    const pct = (missing / data.length) * 100;

    if (pct > 0) {
      checks.push({
        name: `Completeness of ${col}`,
        passed: pct < 5,
        severity: pct > 30 ? 'critical' : pct > 10 ? 'warning' : 'info',
        message: `${missing} missing value(s) (${pct.toFixed(1)}%)`,
        affectedCount: missing,
      });
    }
  }

  // Timeline gap detection for date columns
  const datePatterns = ['date', 'time', 'timestamp', 'created', 'order_date'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (!datePatterns.some(p => lower.includes(p))) continue;
    
    const dates = data.map(r => new Date(String(r[col] || ''))).filter(d => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
    if (dates.length < 10) continue;

    // Check for gaps > 3x median interval
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push(dates[i].getTime() - dates[i - 1].getTime());
    }
    if (intervals.length === 0) continue;
    const sorted = [...intervals].sort((a, b) => a - b);
    const medianInterval = sorted[Math.floor(sorted.length / 2)];
    const gaps = intervals.filter(i => i > medianInterval * 3).length;
    
    if (gaps > 0) {
      checks.push({
        name: `Timeline continuity in ${col}`,
        passed: false,
        severity: 'warning',
        message: `${gaps} gap(s) detected in timeline (>3x median interval)`,
        affectedCount: gaps,
      });
    }
  }

  const missingPct = totalCells > 0 ? (totalMissing / totalCells) * 100 : 0;
  const score = Math.max(0, Math.round(100 - missingPct * 2));

  if (checks.length === 0) {
    checks.push({ name: 'Data completeness', passed: true, severity: 'info', message: 'No missing values detected' });
  }

  return { name: 'Completeness', status: score >= 90 ? 'pass' : score >= 60 ? 'warn' : 'fail', score, checks, summary: `${(100 - missingPct).toFixed(1)}% complete across ${columns.length} columns` };
}

function checkConsistency(data: DataRow[], columns: string[]): PillarResult {
  const checks: PillarCheck[] = [];

  // Check for primary key uniqueness
  const idPatterns = ['id', 'uuid', 'guid', 'key', 'customer_id', 'order_id', 'transaction_id', 'employee_id'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (!idPatterns.some(p => lower === p || lower.endsWith('_' + p) || lower.startsWith(p + '_'))) continue;
    const values = data.map(r => String(r[col] || '')).filter(v => v.trim() !== '');
    const unique = new Set(values);
    const duplicates = values.length - unique.size;
    checks.push({
      name: `Primary key uniqueness: ${col}`,
      passed: duplicates === 0,
      severity: duplicates > 0 ? 'critical' : 'info',
      message: duplicates > 0 ? `${duplicates} duplicate ID(s) — will cause Many-to-Many errors in BI` : `All ${values.length} IDs are unique`,
      affectedCount: duplicates,
    });
  }

  // Check for mixed data types within a column
  for (const col of columns) {
    const nonEmpty = data.map(r => r[col]).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (nonEmpty.length < 5) continue;
    const types = new Set(nonEmpty.map(v => {
      if (typeof v === 'number' || !isNaN(Number(String(v).replace(/,/g, '')))) return 'number';
      if (!isNaN(Date.parse(String(v))) && String(v).length > 4) return 'date';
      return 'string';
    }));
    if (types.size > 1) {
      checks.push({
        name: `Type consistency: ${col}`,
        passed: false,
        severity: 'warning',
        message: `Mixed data types detected: ${[...types].join(', ')}`,
      });
    }
  }

  // Check for currency/unit mixing (look for currency symbols)
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (!['price', 'amount', 'cost', 'total', 'revenue', 'salary', 'payment', 'fee'].some(p => lower.includes(p))) continue;
    const symbols = new Set<string>();
    data.forEach(r => {
      const v = String(r[col] || '');
      const match = v.match(/^[\$€£¥₹₩₪₿]/);
      if (match) symbols.add(match[0]);
    });
    if (symbols.size > 1) {
      checks.push({
        name: `Currency consistency: ${col}`,
        passed: false,
        severity: 'critical',
        message: `Mixed currencies detected: ${[...symbols].join(', ')}`,
      });
    }
  }

  if (checks.length === 0) {
    checks.push({ name: 'Data consistency', passed: true, severity: 'info', message: 'No consistency issues detected' });
  }

  const score = checks.length > 0 ? Math.round((checks.filter(c => c.passed).length / checks.length) * 100) : 100;
  return { name: 'Consistency', status: score >= 90 ? 'pass' : score >= 60 ? 'warn' : 'fail', score, checks, summary: `${checks.filter(c => c.passed).length}/${checks.length} consistency checks passed` };
}

function checkTimeliness(data: DataRow[], columns: string[]): PillarResult {
  const checks: PillarCheck[] = [];
  const now = new Date();

  const datePatterns = ['date', 'time', 'timestamp', 'created', 'updated', 'modified'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (!datePatterns.some(p => lower.includes(p))) continue;

    const dates = data.map(r => new Date(String(r[col] || ''))).filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) continue;

    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const daysSinceLatest = Math.floor((now.getTime() - maxDate.getTime()) / (1000 * 60 * 60 * 24));

    checks.push({
      name: `Data freshness: ${col}`,
      passed: daysSinceLatest < 365,
      severity: daysSinceLatest > 730 ? 'critical' : daysSinceLatest > 365 ? 'warning' : 'info',
      message: daysSinceLatest > 0 ? `Latest record is ${daysSinceLatest} day(s) old (${maxDate.toISOString().split('T')[0]})` : 'Data is current',
    });

    // Check for future dates
    const futureDates = dates.filter(d => d > now).length;
    if (futureDates > 0) {
      checks.push({
        name: `No future dates: ${col}`,
        passed: false,
        severity: 'warning',
        message: `${futureDates} future date(s) detected`,
        affectedCount: futureDates,
      });
    }
  }

  if (checks.length === 0) {
    checks.push({ name: 'Data timeliness', passed: true, severity: 'info', message: 'No date columns to check timeliness' });
  }

  const score = checks.length > 0 ? Math.round((checks.filter(c => c.passed).length / checks.length) * 100) : 100;
  return { name: 'Timeliness', status: score >= 90 ? 'pass' : score >= 60 ? 'warn' : 'fail', score, checks, summary: checks.length > 0 ? checks[0].message : 'N/A' };
}

function checkValidity(data: DataRow[], columns: string[]): PillarResult {
  const checks: PillarCheck[] = [];

  // Email validation
  const emailPatterns = ['email', 'mail', 'e_mail'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (!emailPatterns.some(p => lower.includes(p))) continue;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const nonEmpty = data.map(r => String(r[col] || '')).filter(v => v.trim() !== '' && v !== 'Unknown');
    const invalid = nonEmpty.filter(v => !emailRegex.test(v) && !v.includes('***')).length;
    checks.push({
      name: `Email format: ${col}`,
      passed: invalid === 0,
      severity: invalid > 0 ? 'warning' : 'info',
      message: invalid > 0 ? `${invalid} invalid email format(s)` : 'All emails valid',
      affectedCount: invalid,
    });
  }

  // Phone validation (basic)
  const phonePatterns = ['phone', 'mobile', 'tel', 'contact_number'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (!phonePatterns.some(p => lower.includes(p))) continue;
    const nonEmpty = data.map(r => String(r[col] || '')).filter(v => v.trim() !== '');
    const invalid = nonEmpty.filter(v => !/^[\d\s\-\+\(\)\.]{7,20}$/.test(v)).length;
    checks.push({
      name: `Phone format: ${col}`,
      passed: invalid === 0,
      severity: invalid > 0 ? 'warning' : 'info',
      message: invalid > 0 ? `${invalid} invalid phone number(s)` : 'All phone numbers valid',
      affectedCount: invalid,
    });
  }

  // ZIP/Postal code check
  const zipPatterns = ['zip', 'postal', 'postcode', 'pin_code'];
  for (const col of columns) {
    const lower = col.toLowerCase();
    if (!zipPatterns.some(p => lower.includes(p))) continue;
    const nonEmpty = data.map(r => String(r[col] || '')).filter(v => v.trim() !== '');
    const tooShort = nonEmpty.filter(v => v.replace(/\D/g, '').length < 3).length;
    if (tooShort > 0) {
      checks.push({
        name: `Postal code format: ${col}`,
        passed: false,
        severity: 'warning',
        message: `${tooShort} potentially invalid postal code(s)`,
        affectedCount: tooShort,
      });
    }
  }

  // Check encoding issues (common garbled characters)
  const encodingIssues: { col: string; count: number }[] = [];
  for (const col of columns) {
    let count = 0;
    for (const row of data) {
      const v = String(row[col] || '');
      if (/[ï¿½Ã¢Ã©Ã¨Ã¼Â°Â©Â®]/.test(v)) count++;
    }
    if (count > 0) encodingIssues.push({ col, count });
  }
  if (encodingIssues.length > 0) {
    checks.push({
      name: 'Encoding integrity',
      passed: false,
      severity: 'critical',
      message: `Encoding issues in ${encodingIssues.length} column(s): ${encodingIssues.map(e => `${e.col} (${e.count})`).join(', ')}`,
    });
  }

  // NaN/null string check
  const nanStrings = ['nan', 'none', 'null', 'n/a', '#n/a', '#ref!', '#value!', 'undefined', '#div/0!'];
  let totalNanStrings = 0;
  const nanCols: string[] = [];
  for (const col of columns) {
    const count = data.filter(r => {
      const v = String(r[col] || '').trim().toLowerCase();
      return nanStrings.includes(v);
    }).length;
    if (count > 0) {
      totalNanStrings += count;
      nanCols.push(`${col} (${count})`);
    }
  }
  if (totalNanStrings > 0) {
    checks.push({
      name: 'String-encoded nulls',
      passed: false,
      severity: 'warning',
      message: `${totalNanStrings} null-like string(s) found: ${nanCols.slice(0, 5).join(', ')}`,
      affectedCount: totalNanStrings,
    });
  }

  if (checks.length === 0) {
    checks.push({ name: 'Data validity', passed: true, severity: 'info', message: 'All format validations passed' });
  }

  const score = checks.length > 0 ? Math.round((checks.filter(c => c.passed).length / checks.length) * 100) : 100;
  return { name: 'Validity', status: score >= 90 ? 'pass' : score >= 60 ? 'warn' : 'fail', score, checks, summary: `${checks.filter(c => c.passed).length}/${checks.length} validity checks passed` };
}

// ─── Reconciliation Audit ────────────────────────────────────────────────────

export function generateReconciliationAudit(
  originalData: DataRow[],
  cleanedData: DataRow[],
  originalColumns: string[],
  cleanedColumns: string[]
): ReconciliationAudit {
  const rowsDropped = originalData.length - cleanedData.length;

  // Distribution shift analysis for numeric columns
  const distributionShifts: DistributionShift[] = [];
  for (const col of cleanedColumns) {
    const origCol = originalColumns.find(c => c.toLowerCase().replace(/[^a-z0-9]/g, '_') === col.toLowerCase().replace(/[^a-z0-9]/g, '_')) || col;
    
    const origNums = originalData.map(r => Number(r[origCol])).filter(n => !isNaN(n));
    const cleanNums = cleanedData.map(r => Number(r[col])).filter(n => !isNaN(n));
    if (origNums.length < 5 || cleanNums.length < 5) continue;

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const std = (arr: number[], m: number) => Math.sqrt(arr.reduce((a, v) => a + (v - m) ** 2, 0) / arr.length);

    const meanB = mean(origNums);
    const meanA = mean(cleanNums);
    const stdB = std(origNums, meanB);
    const stdA = std(cleanNums, meanA);
    const shift = meanB !== 0 ? Math.abs((meanA - meanB) / meanB) * 100 : 0;

    distributionShifts.push({
      column: col,
      meanBefore: Math.round(meanB * 100) / 100,
      meanAfter: Math.round(meanA * 100) / 100,
      stdDevBefore: Math.round(stdB * 100) / 100,
      stdDevAfter: Math.round(stdA * 100) / 100,
      shiftPercent: Math.round(shift * 10) / 10,
      isSignificant: shift > 5,
    });
  }

  // Edge-case sampling
  const edgeCaseSamples: EdgeCaseSample[] = [];
  if (cleanedData.length >= 5) {
    edgeCaseSamples.push({ position: 'first_5', rows: cleanedData.slice(0, 5) });
    edgeCaseSamples.push({ position: 'last_5', rows: cleanedData.slice(-5) });
  }
  if (cleanedData.length >= 20) {
    const randomIndices = Array.from({ length: 10 }, () => Math.floor(Math.random() * cleanedData.length));
    edgeCaseSamples.push({ position: 'random_10', rows: randomIndices.map(i => cleanedData[i]) });
  }

  // Schema changes
  const schemaChanges: SchemaChange[] = [];
  const origLower = new Set(originalColumns.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, '_')));
  const cleanLower = new Set(cleanedColumns.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, '_')));

  for (const col of cleanedColumns) {
    const norm = col.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (!origLower.has(norm)) {
      // Check if it was renamed
      const possibleOrig = originalColumns.find(o => o.toLowerCase().replace(/[^a-z0-9]/g, '_') === norm);
      if (possibleOrig) {
        schemaChanges.push({ type: 'renamed', column: col, detail: `${possibleOrig} → ${col}` });
      } else {
        schemaChanges.push({ type: 'added', column: col, detail: `New derived column: ${col}` });
      }
    }
  }
  for (const col of originalColumns) {
    const norm = col.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (!cleanLower.has(norm)) {
      schemaChanges.push({ type: 'removed', column: col, detail: `Column removed: ${col}` });
    }
  }

  return {
    rowCountBefore: originalData.length,
    rowCountAfter: cleanedData.length,
    rowsDropped,
    dropReasons: rowsDropped > 0 ? [{ reason: 'Duplicate removal / schema validation failure', count: rowsDropped }] : [],
    distributionShifts,
    edgeCaseSamples,
    schemaChanges,
  };
}

// ─── Main BI-Readiness Assessment ────────────────────────────────────────────

export function assessBIReadiness(
  data: DataRow[],
  originalData?: DataRow[]
): BIReadinessReport {
  if (data.length === 0) {
    return {
      overallScore: 0, overallStatus: 'fail', isReady: false,
      pillars: [], domainViolations: [], ghostData: [],
      reconciliation: null, timestamp: new Date().toISOString(),
      recommendations: ['Upload a dataset to begin assessment'],
    };
  }

  const columns = Object.keys(data[0]);

  const pillars: PillarResult[] = [
    checkAccuracy(data, columns),
    checkCompleteness(data, columns),
    checkConsistency(data, columns),
    checkTimeliness(data, columns),
    checkValidity(data, columns),
  ];

  const domainViolations = validateDomainConstraints(data);
  const ghostData = detectGhostData(data);

  // Reconciliation audit (if original data provided)
  let reconciliation: ReconciliationAudit | null = null;
  if (originalData && originalData.length > 0) {
    const origCols = Object.keys(originalData[0]);
    reconciliation = generateReconciliationAudit(originalData, data, origCols, columns);
  }

  // Overall score
  const pillarAvg = pillars.reduce((sum, p) => sum + p.score, 0) / pillars.length;
  // Penalize for domain violations and ghost data
  const violationPenalty = Math.min(20, domainViolations.length * 0.5);
  const ghostPenalty = Math.min(10, ghostData.reduce((s, g) => s + g.totalAffected, 0) * 0.01);
  const overallScore = Math.max(0, Math.round(pillarAvg - violationPenalty - ghostPenalty));
  const overallStatus: PillarStatus = overallScore >= 80 ? 'pass' : overallScore >= 50 ? 'warn' : 'fail';

  // Generate recommendations
  const recommendations: string[] = [];
  for (const p of pillars) {
    if (p.status === 'fail') recommendations.push(`CRITICAL: ${p.name} pillar failed — ${p.summary}`);
    else if (p.status === 'warn') recommendations.push(`WARNING: ${p.name} needs attention — ${p.summary}`);
  }
  if (domainViolations.length > 0) recommendations.push(`${domainViolations.length} domain constraint violation(s) detected (temporal logic, range checks)`);
  if (ghostData.length > 0) recommendations.push(`Ghost data (hidden characters/whitespace) found in ${ghostData.length} column(s) — will cause BI join failures`);
  if (reconciliation?.distributionShifts.some(d => d.isSignificant)) {
    recommendations.push('Significant distribution shift detected after cleaning — verify imputation method is not biased');
  }
  if (recommendations.length === 0) recommendations.push('Dataset passes all BI-readiness checks ✓');

  return {
    overallScore,
    overallStatus,
    isReady: overallScore >= 70 && !pillars.some(p => p.status === 'fail'),
    pillars,
    domainViolations,
    ghostData,
    reconciliation,
    timestamp: new Date().toISOString(),
    recommendations,
  };
}

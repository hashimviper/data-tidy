// Contextual Pattern Matching Engine
// Dictionary-based fuzzy header recognition, deep type inference, PII detection,
// normalization, and feature engineering — all client-side, zero API calls.

type DataRow = Record<string, unknown>;

// ─── 1. Fuzzy Header Recognition Dictionary ─────────────────────────────────

export type SemanticRole = 'transaction_date' | 'revenue' | 'identity' | 'category' | 'boolean' | 'age' | 'gender' | 'pii' | 'date_of_birth' | 'unknown';

// Date-of-birth patterns (should NOT be classified as transaction_date)
const DOB_PATTERNS = ['date_of_birth', 'dob', 'birth_date', 'birthdate', 'born'];

const HEADER_DICTIONARY: Record<SemanticRole, string[]> = {
  transaction_date: ['date', 'time', 'timestamp', 'created_at', 'trans_', 'order_date', 'purchase_date', 'datetime', 'created', 'updated_at', 'joining', 'join_date', 'hire_date', 'start_date', 'end_date'],
  revenue: ['amount', 'sales', 'price', 'revenue', 'cost', 'total', 'spend', 'income', 'profit', 'fee', 'charge', 'payment', 'value'],
  identity: ['id', 'uuid', 'guid', 'key', 'customer', 'user', 'employee', 'client', 'account', 'member'],
  category: ['type', 'category', 'group', 'class', 'segment', 'department', 'region', 'channel', 'product_category', 'tier'],
  boolean: ['discount', 'active', 'enabled', 'applied', 'verified', 'approved', 'is_', 'has_', 'flag'],
  age: ['age', 'years_old'],
  gender: ['gender', 'sex'],
  pii: ['email', 'mail', 'phone', 'mobile', 'address', 'ssn', 'social_security', 'passport', 'credit_card', 'card_number'],
  date_of_birth: ['date_of_birth', 'dob', 'birth_date', 'birthdate', 'born'],
  unknown: [],
};

export interface HeaderClassification {
  column: string;
  role: SemanticRole;
  matchedKeyword: string | null;
}

export function classifyHeaders(columns: string[]): HeaderClassification[] {
  return columns.map(col => {
    const lower = col.toLowerCase().replace(/[^a-z0-9_@.]/g, '_');

    // Special case: date_of_birth should NOT be classified as transaction_date
    const isDob = DOB_PATTERNS.some(p => lower.includes(p));
    if (isDob) {
      return { column: col, role: 'date_of_birth' as SemanticRole, matchedKeyword: 'dob' };
    }

    // Special case: age columns should never match 'date' patterns
    const AGE_EXACT = ['age', 'years_old', 'age_at', 'customer_age', 'employee_age', 'user_age'];
    const isAge = AGE_EXACT.some(p => lower === p || lower.endsWith('_' + p) || lower.startsWith(p + '_'));
    if (isAge) {
      return { column: col, role: 'age' as SemanticRole, matchedKeyword: 'age' };
    }

    for (const [role, keywords] of Object.entries(HEADER_DICTIONARY) as [SemanticRole, string[]][]) {
      if (role === 'unknown') continue;
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          return { column: col, role, matchedKeyword: kw };
        }
      }
    }
    return { column: col, role: 'unknown' as SemanticRole, matchedKeyword: null };
  });
}

// ─── 2. Deep Data Type Inference (first 20 rows) ────────────────────────────

export type InferredType = 'boolean_logic' | 'measure' | 'pii_email' | 'text' | 'date' | 'categorical';

export interface ColumnInference {
  column: string;
  inferredType: InferredType;
  sampleSize: number;
}

const EMAIL_PATTERN = /[@]|\.com|\.org|\.net|\.edu|\.io/i;
const BOOLEAN_TOKENS = new Set(['true', 'false', '1', '0', 'yes', 'no', 't', 'f', 'y', 'n']);

export function inferColumnTypes(data: DataRow[]): ColumnInference[] {
  if (data.length === 0) return [];
  const sample = data.slice(0, 20);
  const columns = Object.keys(data[0]);

  return columns.map(col => {
    const values = sample.map(r => r[col]).filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (values.length === 0) return { column: col, inferredType: 'text' as InferredType, sampleSize: 0 };

    // PII check (email)
    const piiCount = values.filter(v => EMAIL_PATTERN.test(String(v))).length;
    if (piiCount / values.length >= 0.5) {
      return { column: col, inferredType: 'pii_email' as InferredType, sampleSize: values.length };
    }

    // Boolean check
    const boolCount = values.filter(v => BOOLEAN_TOKENS.has(String(v).toLowerCase().trim())).length;
    if (boolCount === values.length) {
      return { column: col, inferredType: 'boolean_logic' as InferredType, sampleSize: values.length };
    }

    // 100% digits → Measure
    const digitCount = values.filter(v => /^-?\d+(\.\d+)?$/.test(String(v).replace(/,/g, '').trim())).length;
    if (digitCount === values.length) {
      return { column: col, inferredType: 'measure' as InferredType, sampleSize: values.length };
    }

    return { column: col, inferredType: 'text' as InferredType, sampleSize: values.length };
  });
}

// ─── 3. PII Masking ─────────────────────────────────────────────────────────

function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 1) return '***@***';
  return email[0] + '***' + email.slice(at);
}

// ─── 3b. Robust Date Parser ─────────────────────────────────────────────────

/**
 * Parses a date string in multiple formats and returns ISO YYYY-MM-DD.
 * Handles: ISO, US (MM/DD/YYYY), EU (DD-MM-YYYY, DD/MM/YYYY), and common variants.
 */
function robustDateParse(val: string): string | null {
  if (!val || val.trim() === '') return null;
  const s = val.trim();

  // ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // US format: MM/DD/YYYY or MM-DD-YYYY
  const usMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (usMatch) {
    const [, m, d, y] = usMatch;
    const month = parseInt(m, 10);
    const day = parseInt(d, 10);
    // Heuristic: if first number > 12, it's likely DD/MM/YYYY (EU)
    if (month > 12 && day <= 12) {
      const date = new Date(parseInt(y, 10), day - 1, month);
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    } else {
      const date = new Date(parseInt(y, 10), month - 1, day);
      if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
    }
  }

  // EU format: DD.MM.YYYY
  const euDotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (euDotMatch) {
    const [, d, m, y] = euDotMatch;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }

  // Fallback: try native Date parser
  const fallback = new Date(s);
  if (!isNaN(fallback.getTime()) && s.length > 4) {
    return fallback.toISOString().split('T')[0];
  }

  return null;
}

// ─── 4. Core Contextual Transformation ──────────────────────────────────────

export interface ContextualResult {
  data: DataRow[];
  report: ContextualReport;
}

export interface ContextualReport {
  headerClassifications: HeaderClassification[];
  columnInferences: ColumnInference[];
  measuresDetected: number;
  dimensionsDetected: number;
  missingValuesNormalized: number;
  piiColumnsMasked: string[];
  ageGroupCreated: boolean;
  booleansNormalized: number;
  genderNormalized: number;
  calculatedAgeCreated: boolean;
  ageImputedCount: number;
  outliersCapped: number;
  numericIntegersEnforced: number;
}

export function applyContextualTransformations(data: DataRow[]): ContextualResult {
  if (data.length === 0) {
    return {
      data: [],
      report: {
        headerClassifications: [],
        columnInferences: [],
        measuresDetected: 0,
        dimensionsDetected: 0,
        missingValuesNormalized: 0,
        piiColumnsMasked: [],
        ageGroupCreated: false,
        booleansNormalized: 0,
        genderNormalized: 0,
        calculatedAgeCreated: false,
        ageImputedCount: 0,
        outliersCapped: 0,
        numericIntegersEnforced: 0,
      },
  }

  const columns = Object.keys(data[0]);
  const headerClassifications = classifyHeaders(columns);
  const columnInferences = inferColumnTypes(data);

  // Build lookup maps
  const roleMap = new Map(headerClassifications.map(h => [h.column, h.role]));
  const typeMap = new Map(columnInferences.map(i => [i.column, i.inferredType]));

  let missingValuesNormalized = 0;
  let booleansNormalized = 0;
  let genderNormalized = 0;
  let ageImputedCount = 0;
  const piiColumnsMasked: string[] = [];
  let ageGroupCreated = false;
  let calculatedAgeCreated = false;

  // Detect columns by role
  const ageColumn = headerClassifications.find(h => h.role === 'age')?.column ?? null;
  const dobColumn = headerClassifications.find(h => h.role === 'date_of_birth')?.column ?? null;
  const transDateColumn = headerClassifications.find(h => h.role === 'transaction_date')?.column ?? null;

  // Clone data for mutation
  const result: DataRow[] = data.map(row => ({ ...row }));

  // ── Phase 0: Ghost Data Sanitization ──
  // Remove invisible characters (tabs, newlines, trailing/leading spaces) from ALL text values
  // This prevents BI join failures in Power BI / Tableau
  for (const row of result) {
    for (const col of columns) {
      const val = row[col];
      if (typeof val === 'string') {
        // Strip tabs, newlines, carriage returns, zero-width spaces, and trim
        row[col] = val
          .replace(/[\t\r\n\v\f\u200B\u200C\u200D\uFEFF]/g, '')
          .trim();
      }
    }
  }

  // ── Phase 0b: Date Column Normalization ──
  // Detect date-role columns and normalize all values to ISO YYYY-MM-DD
  const dateColumns = headerClassifications
    .filter(h => h.role === 'transaction_date' || h.role === 'date_of_birth')
    .map(h => h.column);

  for (const col of dateColumns) {
    for (const row of result) {
      const val = row[col];
      if (val === null || val === undefined || String(val).trim() === '') continue;
      const strVal = String(val).trim();

      // Try multiple date formats
      const parsed = robustDateParse(strVal);
      if (parsed) {
        row[col] = parsed; // ISO YYYY-MM-DD string
      }
      // If parsing fails, leave the value as-is (will be caught by schema validation)
    }
  }

  // Identify PII columns to mask
  const piiColumns = columns.filter(col =>
    roleMap.get(col) === 'pii' || typeMap.get(col) === 'pii_email'
  );
  if (piiColumns.length > 0) piiColumnsMasked.push(...piiColumns);

  // Gender mapping (strict explicit only)
  const GENDER_MAP: Record<string, string> = {
    m: 'Male', male: 'Male', M: 'Male', MALE: 'Male',
    f: 'Female', female: 'Female', F: 'Female', FEMALE: 'Female',
  };

  // ── Phase 1: Ensure age column is integer, collect values for median ──
  const ageValues: number[] = [];
  if (ageColumn) {
    for (const row of result) {
      const val = row[ageColumn];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        const num = Number(val);
        if (!isNaN(num) && isFinite(num)) {
          row[ageColumn] = Math.round(num); // Force integer
          ageValues.push(Math.round(num));
        }
      }
    }
  }

  // Compute median age for imputation
  const medianAge = ageValues.length > 0
    ? (() => {
        const sorted = [...ageValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
      })()
    : null;

  // ── Phase 2: Row-level transformations ──
  for (const row of result) {
    for (const col of columns) {
      const role = roleMap.get(col) ?? 'unknown';
      const inferred = typeMap.get(col) ?? 'text';
      const val = row[col];
      const valIsEmpty = val === null || val === undefined || (typeof val === 'string' && val.trim() === '');

      // ── Age column: flag-and-impute strategy ──
      if (role === 'age') {
        if (valIsEmpty || isNaN(Number(val))) {
          if (medianAge !== null) {
            row[col] = medianAge;
            row['is_age_imputed'] = true;
            ageImputedCount++;
          } else {
            row[col] = null;
            row['is_age_imputed'] = true;
          }
        } else {
          row[col] = Math.round(Number(val)); // Enforce integer
          row['is_age_imputed'] = false;
        }
        missingValuesNormalized += valIsEmpty ? 1 : 0;
        continue;
      }

      // ── Missing value normalization (non-age) ──
      if (valIsEmpty) {
        if (inferred === 'measure' || role === 'revenue') {
          row[col] = null;
        } else {
          row[col] = 'Unknown';
        }
        missingValuesNormalized++;
        continue;
      }

      // ── PII masking ──
      if (piiColumns.includes(col) && typeof val === 'string' && val.includes('@')) {
        row[col] = maskEmail(val);
        continue;
      }

      // ── Gender normalization ──
      if (role === 'gender') {
        const strVal = String(val).trim();
        const mapped = GENDER_MAP[strVal] || GENDER_MAP[strVal.toLowerCase()];
        if (mapped) {
          if (row[col] !== mapped) genderNormalized++;
          row[col] = mapped;
        } else {
          row[col] = 'Unknown';
          genderNormalized++;
        }
        continue;
      }

      // ── Boolean normalization → "Yes" / "No" ──
      if (inferred === 'boolean_logic' || role === 'boolean') {
        const str = String(val).toLowerCase().trim();
        if (['1', 'true', 't', 'yes', 'y', 'on'].includes(str)) {
          row[col] = 'Yes';
          booleansNormalized++;
        } else if (['0', 'false', 'f', 'no', 'n', 'off'].includes(str)) {
          row[col] = 'No';
          booleansNormalized++;
        }
        continue;
      }

      // ── Category normalization → Title Case ──
      if (role === 'category' && typeof val === 'string') {
        row[col] = val
          .trim()
          .split(/\s+/)
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
    }

    // ── Feature Engineering: Calculated_Age from DOB + Transaction Date ──
    if (dobColumn && transDateColumn) {
      const dobVal = row[dobColumn];
      const transVal = row[transDateColumn];
      if (dobVal && transVal && String(dobVal).trim() !== '' && String(transVal).trim() !== '') {
        const dobDate = new Date(String(dobVal));
        const transDate = new Date(String(transVal));
        if (!isNaN(dobDate.getTime()) && !isNaN(transDate.getTime())) {
          // Precise age calculation accounting for leap years
          let age = transDate.getFullYear() - dobDate.getFullYear();
          const monthDiff = transDate.getMonth() - dobDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && transDate.getDate() < dobDate.getDate())) {
            age--;
          }
          row['calculated_age'] = Math.max(0, age);
          calculatedAgeCreated = true;
        } else {
          row['calculated_age'] = null;
        }
      } else {
        row['calculated_age'] = null;
      }
    }

    // ── Feature Engineering: age_group ──
    // Use calculated_age if available, otherwise use age column
    const ageForGroup = row['calculated_age'] !== undefined && row['calculated_age'] !== null
      ? Number(row['calculated_age'])
      : (ageColumn && row[ageColumn] !== null && row[ageColumn] !== 'Unknown' ? Number(row[ageColumn]) : NaN);

    if (!isNaN(ageForGroup)) {
      if (ageForGroup < 18) row['age_group'] = 'Under 18';
      else if (ageForGroup <= 25) row['age_group'] = '18-25';
      else if (ageForGroup <= 35) row['age_group'] = '26-35';
      else if (ageForGroup <= 45) row['age_group'] = '36-45';
      else if (ageForGroup <= 60) row['age_group'] = '46-60';
      else row['age_group'] = '60+';
      ageGroupCreated = true;
    } else {
      row['age_group'] = 'Unknown';
    }
  }

  // ── Phase 3: IQR Outlier Capping + Integer Enforcement for numeric columns ──
  let outliersCapped = 0;
  let numericIntegersEnforced = 0;

  // Identify all numeric/measure columns
  const numericColumns = columns.filter(col => {
    const role = roleMap.get(col) ?? 'unknown';
    const inferred = typeMap.get(col) ?? 'text';
    return inferred === 'measure' || role === 'revenue' || role === 'age';
  });

  for (const col of numericColumns) {
    // Collect valid numeric values
    const numVals: number[] = [];
    for (const row of result) {
      const val = row[col];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        const num = Number(String(val).replace(/,/g, ''));
        if (!isNaN(num) && isFinite(num)) numVals.push(num);
      }
    }
    if (numVals.length < 4) continue; // Need enough data for IQR

    // Calculate IQR bounds
    const sorted = [...numVals].sort((a, b) => a - b);
    const q1Idx = Math.floor(sorted.length * 0.25);
    const q3Idx = Math.floor(sorted.length * 0.75);
    const q1 = sorted[q1Idx];
    const q3 = sorted[q3Idx];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    // Determine if this column should be integer (age, count-like, or all values are whole numbers)
    const role = roleMap.get(col) ?? 'unknown';
    const allInteger = numVals.every(v => Number.isInteger(v));
    const isIntegerColumn = role === 'age' || allInteger;

    // Cap outliers and enforce integer type
    for (const row of result) {
      const val = row[col];
      if (val === null || val === undefined || String(val).trim() === '') continue;
      let num = Number(String(val).replace(/,/g, ''));
      if (isNaN(num) || !isFinite(num)) {
        // Convert non-numeric strings to null for numeric columns
        row[col] = null;
        numericIntegersEnforced++;
        continue;
      }

      // Cap outliers within IQR range
      if (num < lowerBound) {
        num = lowerBound;
        outliersCapped++;
      } else if (num > upperBound) {
        num = upperBound;
        outliersCapped++;
      }

      // Enforce integer for integer columns, otherwise round to 2 decimals
      row[col] = isIntegerColumn ? Math.round(num) : Math.round(num * 100) / 100;
      if (typeof val === 'string') numericIntegersEnforced++;
    }
  }

  // Count measures and dimensions
  const measuresDetected = headerClassifications.filter(h => h.role === 'revenue').length +
    columnInferences.filter(i => i.inferredType === 'measure' && !headerClassifications.find(h => h.column === i.column && h.role === 'revenue')).length;
  const dimensionsDetected = headerClassifications.filter(h => ['category', 'gender', 'boolean'].includes(h.role)).length;

  return {
    data: result,
    report: {
      headerClassifications,
      columnInferences,
      measuresDetected,
      dimensionsDetected,
      missingValuesNormalized,
      piiColumnsMasked,
      ageGroupCreated,
      booleansNormalized,
      genderNormalized,
      calculatedAgeCreated,
      ageImputedCount,
      outliersCapped,
      numericIntegersEnforced,
    },
  };
}

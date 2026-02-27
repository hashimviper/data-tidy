// Contextual Pattern Matching Engine
// Dictionary-based fuzzy header recognition, deep type inference, PII detection,
// normalization, and feature engineering — all client-side, zero API calls.

type DataRow = Record<string, unknown>;

// ─── 1. Fuzzy Header Recognition Dictionary ─────────────────────────────────

export type SemanticRole = 'transaction_date' | 'revenue' | 'identity' | 'category' | 'boolean' | 'age' | 'gender' | 'pii' | 'unknown';

const HEADER_DICTIONARY: Record<SemanticRole, string[]> = {
  transaction_date: ['date', 'time', 'timestamp', 'created_at', 'trans_', 'order_date', 'purchase_date', 'datetime', 'created', 'updated_at'],
  revenue: ['amount', 'sales', 'price', 'revenue', 'cost', 'total', 'spend', 'income', 'profit', 'fee', 'charge', 'payment', 'value'],
  identity: ['id', 'uuid', 'guid', 'key', 'customer', 'user', 'employee', 'client', 'account', 'member'],
  category: ['type', 'category', 'group', 'class', 'segment', 'department', 'region', 'channel', 'product_category', 'tier'],
  boolean: ['discount', 'active', 'enabled', 'applied', 'verified', 'approved', 'is_', 'has_', 'flag'],
  age: ['age', 'years_old'],
  gender: ['gender', 'sex'],
  pii: ['email', 'mail', 'phone', 'mobile', 'address', 'ssn', 'social_security', 'passport', 'credit_card', 'card_number'],
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
      },
    };
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
  const piiColumnsMasked: string[] = [];
  let ageGroupCreated = false;

  // Detect age column by role OR by inference
  const ageColumn = headerClassifications.find(h => h.role === 'age')?.column ?? null;

  // Clone data for mutation
  const result: DataRow[] = data.map(row => ({ ...row }));

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

  for (const row of result) {
    for (const col of columns) {
      const role = roleMap.get(col) ?? 'unknown';
      const inferred = typeMap.get(col) ?? 'text';
      const val = row[col];
      const isEmpty = val === null || val === undefined || (typeof val === 'string' && val.trim() === '');

      // ── Missing value normalization ──
      if (isEmpty) {
        if (inferred === 'measure' || role === 'revenue') {
          row[col] = null; // null for numbers
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

    // ── Feature Engineering: age_group ──
    if (ageColumn && row[ageColumn] !== null && row[ageColumn] !== 'Unknown') {
      const age = Number(row[ageColumn]);
      if (!isNaN(age)) {
        if (age < 18) row['age_group'] = 'Under 18';
        else if (age <= 25) row['age_group'] = '18-25';
        else if (age <= 35) row['age_group'] = '26-35';
        else if (age <= 45) row['age_group'] = '36-45';
        else if (age <= 60) row['age_group'] = '46-60';
        else row['age_group'] = '60+';
        ageGroupCreated = true;
      } else {
        row['age_group'] = 'Unknown';
      }
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
    },
  };
}

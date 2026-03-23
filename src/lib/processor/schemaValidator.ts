/**
 * Zod-based schema validator.
 * Lenient validation: coerces values to target types, only rejects truly corrupt rows.
 */

import { z } from 'zod';

export interface ValidationResult<T> {
  validRows: T[];
  rejectedRows: RejectedRow[];
}

export interface RejectedRow {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: string[];
}

/**
 * Build a dynamic Zod schema from column definitions.
 * Uses permissive coercion — values are transformed to target types where possible,
 * and only rejected if completely uncoercible.
 */
export function buildRowSchema(columns: ColumnDef[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const col of columns) {
    switch (col.type) {
      case 'number':
        // Accept numbers, numeric strings, null, empty, and placeholders like "Unknown"
        shape[col.name] = z.preprocess(
          (v) => {
            if (v === null || v === undefined || v === '') return null;
            const s = String(v).trim();
            if (s.toLowerCase() === 'unknown' || s.toLowerCase() === 'n/a' || s === '-') return null;
            const num = Number(s.replace(/,/g, ''));
            return isNaN(num) ? null : num;
          },
          z.number().nullable()
        );
        break;
      case 'boolean':
        // Accept booleans, boolean-like strings, "Yes"/"No" (post-transform), and nulls
        shape[col.name] = z.preprocess(
          (v) => {
            if (v === null || v === undefined) return null;
            if (typeof v === 'boolean') return v;
            const s = String(v).toLowerCase().trim();
            if (['yes', 'true', '1', 'y', 't', 'on'].includes(s)) return true;
            if (['no', 'false', '0', 'n', 'f', 'off', 'unknown'].includes(s)) return false;
            return null;
          },
          z.boolean().nullable()
        );
        break;
      case 'date':
        // Accept any string/null — date format validated elsewhere
        shape[col.name] = z.preprocess(
          (v) => (v === null || v === undefined ? null : String(v)),
          z.string().nullable()
        );
        break;
      default:
        // Accept anything as string
        shape[col.name] = z.preprocess(
          (v) => (v === null || v === undefined ? null : String(v)),
          z.string().nullable()
        );
    }
  }

  return z.object(shape).passthrough();
}

export interface ColumnDef {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date';
}

/**
 * Validate all rows against a schema and separate valid/rejected.
 */
export function validateRows<T extends Record<string, unknown>>(
  data: Record<string, unknown>[],
  schema: z.ZodObject<Record<string, z.ZodTypeAny>>
): ValidationResult<T> {
  const validRows: T[] = [];
  const rejectedRows: RejectedRow[] = [];

  data.forEach((row, index) => {
    const result = schema.safeParse(row);
    if (result.success) {
      validRows.push(result.data as T);
    } else {
      rejectedRows.push({
        rowIndex: index,
        data: row,
        errors: result.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`
        ),
      });
    }
  });

  return { validRows, rejectedRows };
}

/**
 * Auto-detect column definitions from sample data.
 * Uses post-contextual-transform data, so "Yes"/"No" are treated as strings,
 * and numeric columns with "Unknown" placeholders are still detected as numbers.
 */
export function inferColumnDefs(data: Record<string, unknown>[]): ColumnDef[] {
  if (data.length === 0) return [];
  const sample = data.slice(0, 50); // Larger sample for better inference
  const columns = Object.keys(data[0]);

  // Age column patterns — must be forced to 'number', never 'date'
  const AGE_PATTERNS = ['age', 'years_old', 'age_at', 'customer_age', 'employee_age', 'user_age', 'calculated_age'];
  // Revenue/numeric patterns
  const NUMERIC_PATTERNS = ['amount', 'price', 'cost', 'total', 'revenue', 'salary', 'income', 'fee', 'charge', 'payment', 'quantity', 'count', 'score', 'rate', 'balance'];
  // ID patterns — always string
  const ID_PATTERNS = ['id', 'uuid', 'guid', 'key', 'code', 'number', 'no', 'num'];

  return columns.map((name) => {
    const lowerName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    
    // Force age columns to number
    const isAge = AGE_PATTERNS.some(p => lowerName === p || lowerName.endsWith('_' + p) || lowerName.startsWith(p + '_'));
    if (isAge) return { name, type: 'number' as const };

    // Force revenue/numeric keyword columns to number
    const isNumericByName = NUMERIC_PATTERNS.some(p => lowerName.includes(p));

    // Force ID columns to string (even if they look numeric)
    const isId = ID_PATTERNS.some(p => lowerName === p || lowerName.endsWith('_' + p) || lowerName.startsWith(p + '_'));
    if (isId) return { name, type: 'string' as const };

    // Derived columns
    if (lowerName === 'is_age_imputed') return { name, type: 'boolean' as const };
    if (lowerName === 'age_group') return { name, type: 'string' as const };

    const values = sample
      .map((r) => r[name])
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'unknown');

    if (values.length === 0) return { name, type: 'string' as const };

    // Check for "Yes"/"No" pattern (post-contextual-transform booleans)
    const yesNoTokens = new Set(['yes', 'no']);
    const allYesNo = values.every((v) => yesNoTokens.has(String(v).toLowerCase().trim()));
    if (allYesNo) return { name, type: 'string' as const }; // Keep as string post-transform

    // Boolean check (raw data)
    const boolTokens = new Set(['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', 't', 'f']);
    const allBool = values.every((v) => boolTokens.has(String(v).toLowerCase().trim()));
    if (allBool) return { name, type: 'boolean' as const };

    // Numeric check — filter out "Unknown" and check remaining
    const numericValues = values.filter(v => {
      const s = String(v).replace(/,/g, '').trim();
      return /^-?\d+(\.\d+)?$/.test(s);
    });
    // If >80% of non-empty values are numeric, or column name suggests numeric
    if (numericValues.length === values.length || (isNumericByName && numericValues.length > values.length * 0.5)) {
      return { name, type: 'number' as const };
    }

    return { name, type: 'string' as const };
  });
}

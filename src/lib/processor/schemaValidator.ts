/**
 * Zod-based schema validator.
 * Validates each row and separates valid from rejected rows.
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
 * Columns with type 'number' expect coercible numbers, others are strings.
 */
export function buildRowSchema(columns: ColumnDef[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const col of columns) {
    switch (col.type) {
      case 'number':
        shape[col.name] = z.preprocess(
          (v) => (v === null || v === undefined || v === '' ? null : Number(String(v).replace(/,/g, ''))),
          z.number().nullable()
        );
        break;
      case 'boolean':
        shape[col.name] = z.preprocess(
          (v) => {
            if (typeof v === 'boolean') return v;
            const s = String(v).toLowerCase().trim();
            if (['yes', 'true', '1', 'y', 't'].includes(s)) return true;
            if (['no', 'false', '0', 'n', 'f'].includes(s)) return false;
            return null;
          },
          z.boolean().nullable()
        );
        break;
      case 'date':
        shape[col.name] = z.string().nullable().default(null);
        break;
      default:
        shape[col.name] = z.string().nullable().default(null);
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
 */
export function inferColumnDefs(data: Record<string, unknown>[]): ColumnDef[] {
  if (data.length === 0) return [];
  const sample = data.slice(0, 20);
  const columns = Object.keys(data[0]);

  // Age column patterns — must be forced to 'number', never 'date'
  const AGE_PATTERNS = ['age', 'years_old', 'age_at', 'customer_age', 'employee_age', 'user_age', 'calculated_age'];

  return columns.map((name) => {
    const lowerName = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const isAge = AGE_PATTERNS.some(p => lowerName === p || lowerName.endsWith('_' + p) || lowerName.startsWith(p + '_'));

    // Force age columns to number type
    if (isAge) return { name, type: 'number' as const };

    const values = sample
      .map((r) => r[name])
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');

    if (values.length === 0) return { name, type: 'string' as const };

    const boolTokens = new Set(['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', 't', 'f']);
    const allBool = values.every((v) => boolTokens.has(String(v).toLowerCase().trim()));
    if (allBool) return { name, type: 'boolean' as const };

    const allNumeric = values.every((v) => /^-?\d+([.,]\d+)?$/.test(String(v).replace(/,/g, '').trim()));
    if (allNumeric) return { name, type: 'number' as const };

    return { name, type: 'string' as const };
  });
}

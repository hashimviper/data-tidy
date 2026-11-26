export type ExportProfile = 'bi_ready' | 'ml_training_ready' | 'data_engineering_ready';
type DataRow = Record<string, unknown>;

export interface ExportProfileResult {
  profile: ExportProfile;
  ready: boolean;
  data: DataRow[];
  errors: string[];
  warnings: string[];
  primaryKey: string | null;
  encodedColumns: number;
  excludedIdentifiers: string[];
}

const ID_PATTERN = /(?:^|_)(?:id|uuid|guid|key|code|number|no|num)(?:_|$)/;
const EMPTY_KEY_VALUES = new Set(['', 'unknown', 'null', 'n/a', 'na', '-']);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function addError(errors: string[], message: string): void {
  if (errors.length < 100) errors.push(message);
}

function isIdentifier(column: string): boolean {
  return ID_PATTERN.test(column.toLowerCase());
}

function isMissingKey(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && EMPTY_KEY_VALUES.has(value.trim().toLowerCase()));
}

function checkShape(data: DataRow[]): string[] {
  if (data.length === 0) return ['There are no rows to export.'];
  const expected = Object.keys(data[0]).sort();
  const errors: string[] = [];
  data.forEach((row, index) => {
    if (errors.length >= 100) return;
    const actual = Object.keys(row).sort();
    if (actual.length !== expected.length || actual.some((key, columnIndex) => key !== expected[columnIndex])) {
      addError(errors, `Row ${index + 1} does not match the dataset column structure.`);
    }
    for (const [column, value] of Object.entries(row)) {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        addError(errors, `Column "${column}" contains a non-finite number.`);
      } else if (value !== null && value !== undefined && typeof value === 'object' && !(value instanceof Date)) {
        addError(errors, `Column "${column}" contains a nested value that cannot be exported as a flat table.`);
      }
    }
  });
  return Array.from(new Set(errors));
}

function createMlRows(data: DataRow[], errors: string[]): { data: DataRow[]; encoded: number; excluded: string[] } {
  const columns = Object.keys(data[0] ?? {});
  const identifierColumns = columns.filter(isIdentifier);
  const featureColumns = columns.filter((column) => !identifierColumns.includes(column));
  const categories = new Map<string, string[]>();
  const encodedNames = new Map<string, string[]>();
  const dateColumns = new Set<string>();

  for (const column of featureColumns) {
    const values = data.map((row) => row[column]);
    const strings = values.filter((value): value is string => typeof value === 'string');
    if (strings.length === 0) continue;
    if (strings.every((value) => ISO_DATE_PATTERN.test(value))) {
      dateColumns.add(column);
      continue;
    }
    const distinct = Array.from(new Set(strings));
    if (distinct.length > 100) {
      addError(errors, `Column "${column}" has more than 100 text categories; choose an encoding before ML export.`);
    } else {
      categories.set(column, distinct);
      const usedNames = new Set(featureColumns.filter((item) => !categories.has(item)));
      const names = distinct.map((value) => {
        const suffix = value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'empty';
        const base = `${column}__${suffix}`;
        let name = base;
        let next = 2;
        while (usedNames.has(name)) {
          name = `${base}_${next}`;
          next++;
        }
        usedNames.add(name);
        return name;
      });
      encodedNames.set(column, names);
    }
  }

  const output = data.map((row) => {
    const converted: DataRow = {};
    for (const column of featureColumns) {
      const value = row[column];
      if (dateColumns.has(column)) {
        const date = value instanceof Date ? value : new Date(String(value));
        converted[column] = Number.isNaN(date.getTime()) ? null : Math.floor(date.getTime() / 86_400_000);
      } else if (!categories.has(column)) {
        converted[column] = value;
      }
    }
    for (const [column, values] of categories) {
      values.forEach((value, index) => {
        const outputName = encodedNames.get(column)?.[index];
        if (outputName) converted[outputName] = row[column] === value ? 1 : 0;
      });
    }
    return converted;
  });

  output.forEach((row, index) => {
    for (const [column, value] of Object.entries(row)) {
      if (value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value))) {
        addError(errors, `Row ${index + 1} has a missing or invalid ML value in "${column}".`);
      }
    }
  });

  return { data: output, encoded: Array.from(categories.keys()).length, excluded: identifierColumns };
}

function validatePrimaryKey(data: DataRow[], key: string | null): string[] {
  if (!key) return ['Select a primary key column to verify uniqueness.'];
  const seen = new Set<string>();
  const errors: string[] = [];
  data.forEach((row, index) => {
    const value = row[key];
    if (isMissingKey(value)) {
      addError(errors, `Primary key "${key}" is missing in row ${index + 1}.`);
      return;
    }
    const normalized = `${typeof value}:${String(value)}`;
    if (seen.has(normalized)) addError(errors, `Primary key "${key}" is duplicated at row ${index + 1}.`);
    seen.add(normalized);
  });
  return errors;
}

export function getIdentifierColumns(data: DataRow[]): string[] {
  return Object.keys(data[0] ?? {}).filter(isIdentifier);
}

export function validateExportProfile(data: DataRow[], profile: ExportProfile, primaryKey?: string): ExportProfileResult {
  const errors = checkShape(data);
  const keyColumns = getIdentifierColumns(data);
  let exportData = data;
  let encodedColumns = 0;
  let excludedIdentifiers: string[] = [];
  let selectedKey: string | null = null;

  if (profile === 'bi_ready') {
    selectedKey = primaryKey ?? keyColumns[0] ?? null;
    const keysToCheck = Array.from(new Set([...keyColumns, ...(selectedKey ? [selectedKey] : [])]));
    for (const key of keysToCheck) {
      data.forEach((row, index) => {
        if (errors.length < 100 && isMissingKey(row[key])) addError(errors, `Key column "${key}" is missing in row ${index + 1}.`);
      });
    }
    if (!selectedKey) addError(errors, 'Select a key column so key completeness can be verified.');
    data.forEach((row, index) => {
      if (errors.length >= 100) return;
      for (const [column, value] of Object.entries(row)) {
        if (typeof value === 'string' && (value !== value.trim() || /\s{2,}|[\u0000-\u001F\u007F]/.test(value))) {
          addError(errors, `Dimension "${column}" is not whitespace/control-character clean in row ${index + 1}.`);
          break;
        }
      }
    });
  } else if (profile === 'ml_training_ready') {
    const transformed = createMlRows(data, errors);
    exportData = transformed.data;
    encodedColumns = transformed.encoded;
    excludedIdentifiers = transformed.excluded;
  } else {
    selectedKey = primaryKey ?? keyColumns[0] ?? null;
    errors.push(...validatePrimaryKey(data, selectedKey));
  }

  return {
    profile,
    ready: errors.length === 0,
    data: exportData,
    errors: Array.from(new Set(errors)).slice(0, 100),
    warnings: keyColumns.length === 0 ? ['No identifier-like column was detected.'] : [],
    primaryKey: selectedKey,
    encodedColumns,
    excludedIdentifiers,
  };
}
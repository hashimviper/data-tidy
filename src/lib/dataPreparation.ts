import Papa from 'papaparse';

export type DataRow = Record<string, unknown>;

export interface IngestionReport {
  encoding: string;
  headersRenamed: number;
  duplicateHeaders: number;
  raggedRows: number;
  extraCells: number;
  sanitizedTextCells: number;
  missingPlaceholders: number;
  numericValuesParsed: number;
  invalidNumericValues: number;
  details: string[];
}

export interface PreparedRows {
  data: DataRow[];
  report: IngestionReport;
}

const EMPTY_REPORT: IngestionReport = {
  encoding: 'native',
  headersRenamed: 0,
  duplicateHeaders: 0,
  raggedRows: 0,
  extraCells: 0,
  sanitizedTextCells: 0,
  missingPlaceholders: 0,
  numericValuesParsed: 0,
  invalidNumericValues: 0,
  details: [],
};

const NUMERIC_HEADER_HINTS = [
  'age', 'salary', 'wage', 'revenue', 'amount', 'price', 'cost', 'total', 'income', 'profit',
  'quantity', 'count', 'score', 'rate', 'percent', 'balance', 'attendance', 'weight', 'height',
];

const ID_HEADER_PATTERN = /(?:^|_)(?:id|uuid|guid|key|code|number|no|num)(?:_|$)/;
const NULL_TOKENS = new Set(['', 'n/a', 'na', 'null', 'nil', 'none', '?', '-', '—', '(blank)']);

const CP1252_BYTES: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87,
  'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91,
  '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98,
  '™': 0x99, 'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

function repairMojibake(value: string): string {
  if (!/(?:Ã.|Â.|â€|ï¿½|�)/.test(value)) return value;
  const bytes: number[] = [];
  for (const character of value) {
    const code = CP1252_BYTES[character] ?? character.codePointAt(0);
    if (code === undefined || code > 255) return value;
    bytes.push(code);
  }
  try {
    const repaired = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
    const markerCount = (text: string) => (text.match(/(?:Ã.|Â.|â€|ï¿½|�)/g) ?? []).length;
    return markerCount(repaired) < markerCount(value) ? repaired : value;
  } catch {
    return value;
  }
}

function sanitizeText(value: string): string {
  return repairMojibake(value.normalize('NFKC'))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function standardizeHeader(header: string, index = 0): string {
  const normalized = sanitizeText(header)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return normalized || `column_${index + 1}`;
}

function uniqueHeaders(headers: string[]): { headers: string[]; renamed: number; duplicates: number } {
  const used = new Map<string, number>();
  let renamed = 0;
  let duplicates = 0;
  const normalized = headers.map((header, index) => {
    const base = standardizeHeader(header, index);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const unique = count === 0 ? base : `${base}_${count + 1}`;
    if (header !== unique) renamed++;
    if (count > 0) duplicates++;
    return unique;
  });
  return { headers: normalized, renamed, duplicates };
}

function missingToken(value: unknown): boolean {
  return typeof value === 'string' && NULL_TOKENS.has(value.trim().toLowerCase());
}

export function parseDirtyNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.trim();
  if (!text) return null;

  const negative = /^\(.*\)$/.test(text);
  if (negative) text = text.slice(1, -1).trim();
  text = text.replace(/(?:\b(?:USD|EUR|GBP|CAD|AUD|JPY)\b|[$€£¥%])/gi, '').replace(/[\s'’]/g, '');
  if (!/^[+-]?[\d.,]+$/.test(text)) return null;

  const commaCount = (text.match(/,/g) ?? []).length;
  const dotCount = (text.match(/\./g) ?? []).length;
  if (commaCount > 0 && dotCount > 0) {
    const decimal = text.lastIndexOf(',') > text.lastIndexOf('.') ? ',' : '.';
    const grouping = decimal === ',' ? /\./g : /,/g;
    text = text.replace(grouping, '').replace(decimal, '.');
  } else if (commaCount > 0) {
    const groups = text.split(',');
    const grouped = groups.length > 2 || (groups.length === 2 && groups[1].length === 3 && groups[0].length > 0);
    text = grouped ? groups.join('') : groups.join('.');
  } else if (dotCount > 1) {
    const groups = text.split('.');
    const grouped = groups.slice(1).every((group) => group.length === 3);
    if (grouped) text = groups.join('');
    else return null;
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function looksLikeIdentifier(column: string): boolean {
  return ID_HEADER_PATTERN.test(column);
}

function isNumericCandidate(column: string, values: unknown[]): boolean {
  if (looksLikeIdentifier(column)) return false;
  const available = values.filter((value) => value !== null && value !== undefined);
  if (available.length === 0) return false;
  const parseableCount = available.filter((value) => parseDirtyNumber(value) !== null).length;
  const ratio = parseableCount / available.length;
  const numericByName = NUMERIC_HEADER_HINTS.some((hint) => column.includes(hint));
  return ratio >= 0.8 || (numericByName && ratio >= 0.5);
}

export function prepareInputRows(input: DataRow[]): PreparedRows {
  const report: IngestionReport = { ...EMPTY_REPORT, details: [] };
  if (input.length === 0) return { data: [], report };

  const allOriginalHeaders = Array.from(new Set(input.flatMap((row) => Object.keys(row))));
  const unique = uniqueHeaders(allOriginalHeaders);
  report.headersRenamed = unique.renamed;
  report.duplicateHeaders = unique.duplicates;
  const headerMap = new Map(allOriginalHeaders.map((header, index) => [header, unique.headers[index]]));

  const data = input.map((row) => {
    const normalized: DataRow = {};
    for (const header of allOriginalHeaders) {
      const outputHeader = headerMap.get(header);
      if (!outputHeader) continue;
      const value = row[header];
      if (typeof value === 'string') {
        const cleaned = sanitizeText(value);
        if (cleaned !== value) report.sanitizedTextCells++;
        if (missingToken(cleaned)) {
          normalized[outputHeader] = null;
          report.missingPlaceholders++;
        } else {
          normalized[outputHeader] = cleaned;
        }
      } else {
        normalized[outputHeader] = value === undefined ? null : value;
      }
    }
    return normalized;
  });

  for (const column of unique.headers) {
    const values = data.map((row) => row[column]);
    if (!isNumericCandidate(column, values)) continue;
    for (const row of data) {
      const value = row[column];
      if (value === null || value === undefined) continue;
      if (String(value).trim() === '-999') {
        row[column] = null;
        report.missingPlaceholders++;
        continue;
      }
      const parsed = parseDirtyNumber(value);
      if (parsed === null) {
        row[column] = null;
        report.invalidNumericValues++;
        continue;
      }
      if (typeof value === 'string') {
        if (String(parsed) !== value.trim()) report.numericValuesParsed++;
        row[column] = parsed;
      }
    }
  }

  if (report.headersRenamed > 0) report.details.push(`Standardized ${report.headersRenamed} column headers`);
  if (report.duplicateHeaders > 0) report.details.push(`Disambiguated ${report.duplicateHeaders} duplicate column headers`);
  if (report.raggedRows > 0) report.details.push(`Repaired ${report.raggedRows} rows with uneven column counts`);
  if (report.sanitizedTextCells > 0) report.details.push(`Cleaned hidden characters or whitespace in ${report.sanitizedTextCells} cells`);
  if (report.missingPlaceholders > 0) report.details.push(`Converted ${report.missingPlaceholders} missing-value placeholders to null`);
  if (report.numericValuesParsed > 0) report.details.push(`Parsed ${report.numericValuesParsed} dirty numeric values`);
  if (report.invalidNumericValues > 0) report.details.push(`Flagged ${report.invalidNumericValues} unparseable numeric values as null`);
  return { data, report };
}

export async function parseDelimitedFile(file: File): Promise<PreparedRows> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let encoding = 'UTF-8';
  let content: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'UTF-16LE';
    content = new TextDecoder('utf-16le').decode(bytes.subarray(2));
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = 'UTF-16BE';
    content = new TextDecoder('utf-16be').decode(bytes.subarray(2));
  } else {
    const payload = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(payload);
    } catch {
      encoding = 'Windows-1252';
      content = new TextDecoder('windows-1252').decode(payload);
    }
  }

  const delimiter = file.name.toLowerCase().endsWith('.tsv') ? '\t' : '';
  const parsed = Papa.parse<string[]>(content, { delimiter, skipEmptyLines: 'greedy', dynamicTyping: false });
  if (parsed.errors.some((error) => error.type !== 'FieldMismatch')) {
    throw new Error(`Could not safely parse this delimited file: ${parsed.errors[0]?.message ?? 'unknown parse error'}`);
  }
  const rows = parsed.data;
  if (rows.length < 2) throw new Error('The file must contain a header and at least one data row.');

  const rawHeaders = rows[0].map((value) => String(value ?? ''));
  const headerInfo = uniqueHeaders(rawHeaders);
  let raggedRows = 0;
  let extraCells = 0;
  const largestRow = rows.slice(1).reduce((largest, row) => Math.max(largest, row.length), rawHeaders.length);
  const headers = [...headerInfo.headers];
  for (let index = headers.length; index < largestRow; index++) headers.push(`extra_column_${index - rawHeaders.length + 1}`);

  const records = rows.slice(1).map((row) => {
    if (row.length !== rawHeaders.length) raggedRows++;
    if (row.length > rawHeaders.length) extraCells += row.length - rawHeaders.length;
    const record: DataRow = {};
    headers.forEach((header, index) => {
      record[header] = index < row.length ? row[index] : null;
    });
    return record;
  });
  const prepared = prepareInputRows(records);
  prepared.report.encoding = encoding;
  prepared.report.headersRenamed += headerInfo.renamed;
  prepared.report.duplicateHeaders += headerInfo.duplicates;
  prepared.report.raggedRows = raggedRows;
  prepared.report.extraCells = extraCells;
  if (encoding !== 'UTF-8') prepared.report.details.push(`Decoded file using ${encoding}`);
  if (headerInfo.renamed > 0) prepared.report.details.push(`Standardized ${headerInfo.renamed} column headers`);
  if (headerInfo.duplicates > 0) prepared.report.details.push(`Disambiguated ${headerInfo.duplicates} duplicate column headers`);
  if (raggedRows > 0) prepared.report.details.push(`Repaired ${raggedRows} rows with uneven column counts`);
  if (extraCells > 0) prepared.report.details.push(`Preserved ${extraCells} extra cell values in added columns`);
  return prepared;
}

export async function parseJsonFile(file: File): Promise<PreparedRows> {
  const parsed: unknown = JSON.parse(await file.text());
  if (!Array.isArray(parsed) || parsed.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new Error('JSON files must contain an array of row objects.');
  }
  return prepareInputRows(parsed as DataRow[]);
}

export function mergeIngestionReports(...reports: IngestionReport[]): IngestionReport {
  const merged = { ...EMPTY_REPORT, details: [] as string[] };
  for (const report of reports) {
    if (report.encoding !== 'native') merged.encoding = report.encoding;
    for (const key of [
      'headersRenamed', 'duplicateHeaders', 'raggedRows', 'extraCells', 'sanitizedTextCells',
      'missingPlaceholders', 'numericValuesParsed', 'invalidNumericValues',
    ] as const) merged[key] += report[key];
    merged.details.push(...report.details);
  }
  merged.details = Array.from(new Set(merged.details));
  return merged;
}
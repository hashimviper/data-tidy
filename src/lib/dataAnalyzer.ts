// Data analysis and profiling utilities with enhanced column classification

import { 
  ColumnProfile, 
  NumericStats, 
  CategoricalInfo, 
  DateInfo, 
  ColumnIssue, 
  DatasetProfile,
  ColumnClassification,
  DataDescription
} from './dataTypes';

// Enhanced date patterns for multi-format parsing
const DATE_PATTERNS = [
  { pattern: /^\d{4}-\d{2}-\d{2}$/, format: 'YYYY-MM-DD' },
  { pattern: /^\d{4}\/\d{2}\/\d{2}$/, format: 'YYYY/MM/DD' },
  { pattern: /^\d{2}\/\d{2}\/\d{4}$/, format: 'MM/DD/YYYY' },
  { pattern: /^\d{2}-\d{2}-\d{4}$/, format: 'DD-MM-YYYY' },
  { pattern: /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, format: 'D/M/YY' },
  { pattern: /^\d{1,2}-\d{1,2}-\d{2,4}$/, format: 'D-M-YY' },
  { pattern: /^\d{1,2}\s+\w{3,9}\s+\d{4}$/i, format: 'D MMM YYYY' },
  { pattern: /^\w{3,9}\s+\d{1,2},?\s+\d{4}$/i, format: 'MMM D, YYYY' },
  { pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, format: 'ISO' },
  { pattern: /^\d{8}$/, format: 'YYYYMMDD' },
];

const BOOLEAN_VALUES = {
  true: ['true', 'yes', '1', 'y', 't', 'on', 'active', 'enabled'],
  false: ['false', 'no', '0', 'n', 'f', 'off', 'inactive', 'disabled'],
};

// Enhanced date parsing with multiple format support
export function parseMultiFormatDate(value: unknown): { date: Date | null; format: string } {
  if (!value) return { date: null, format: 'unknown' };
  if (value instanceof Date) return { date: value, format: 'Date' };
  
  const str = String(value).trim();
  if (!str) return { date: null, format: 'unknown' };
  
  // Try YYYYMMDD format
  if (/^\d{8}$/.test(str)) {
    const y = parseInt(str.substring(0, 4));
    const m = parseInt(str.substring(4, 6)) - 1;
    const d = parseInt(str.substring(6, 8));
    const date = new Date(y, m, d);
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      return { date, format: 'YYYYMMDD' };
    }
  }
  
  // Try ISO format first
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
      return { date: parsed, format: 'YYYY-MM-DD' };
    }
  }
  
  // Try YYYY/MM/DD
  const ymdSlash = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
  if (ymdSlash) {
    const parsed = new Date(parseInt(ymdSlash[1]), parseInt(ymdSlash[2]) - 1, parseInt(ymdSlash[3]));
    if (!isNaN(parsed.getTime())) return { date: parsed, format: 'YYYY/MM/DD' };
  }
  
  // Try MM/DD/YYYY
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const parsed = new Date(parseInt(mdyMatch[3]), parseInt(mdyMatch[1]) - 1, parseInt(mdyMatch[2]));
    if (!isNaN(parsed.getTime())) return { date: parsed, format: 'MM/DD/YYYY' };
  }
  
  // Try DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const parsed = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
    if (!isNaN(parsed.getTime())) return { date: parsed, format: 'DD-MM-YYYY' };
  }
  
  // Try DD/MM/YYYY
  const dmySlash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmySlash) {
    // Ambiguous - try DD/MM/YYYY if day > 12
    const first = parseInt(dmySlash[1]);
    const second = parseInt(dmySlash[2]);
    if (first > 12 && second <= 12) {
      const parsed = new Date(parseInt(dmySlash[3]), second - 1, first);
      if (!isNaN(parsed.getTime())) return { date: parsed, format: 'DD/MM/YYYY' };
    }
  }
  
  // Try natural language formats
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
    return { date: parsed, format: 'natural' };
  }
  
  return { date: null, format: 'unknown' };
}

// Detect if column is time-series based on data patterns
export function detectTimeSeriesColumn(name: string, values: unknown[], dateColumns: string[]): boolean {
  const lowerName = name.toLowerCase();
  
  // Check if column name suggests time-series
  const timeSeriesPatterns = [
    'revenue', 'sales', 'amount', 'count', 'total', 'value', 'metric',
    'measurement', 'reading', 'quantity', 'units', 'volume', 'rate',
    'growth', 'change', 'delta', 'daily', 'monthly', 'weekly', 'yearly',
    'balance', 'cumulative', 'running'
  ];
  
  const isTimeSeriesName = timeSeriesPatterns.some(p => lowerName.includes(p));
  
  // If dataset has date columns and this is a numeric column, likely time-series
  const hasDateContext = dateColumns.length > 0;
  
  // Check if values are numeric
  const numericValues = values.filter(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)));
  const isNumeric = numericValues.length / values.length > 0.9;
  
  return isNumeric && (isTimeSeriesName || hasDateContext);
}

// Detect column classification
export function classifyColumn(
  name: string, 
  values: unknown[], 
  dataType: string,
  dateColumns: string[]
): ColumnClassification {
  const lowerName = name.toLowerCase();
  
  // Check if derived column
  if (lowerName.includes('_year') || lowerName.includes('_quarter') || 
      lowerName.includes('_month') || lowerName.includes('_day_of_week') ||
      lowerName.includes('_month_name')) {
    return 'derived';
  }
  
  // Identifier patterns
  const idPatterns = ['id', '_id', 'key', 'code', 'uuid', 'guid', 'number', 'no', 'index'];
  const isIdentifier = idPatterns.some(p => lowerName === p || lowerName.endsWith('_' + p) || lowerName.startsWith(p + '_'));
  
  if (isIdentifier && dataType !== 'date') {
    return 'identifier';
  }
  
  if (dataType === 'date') {
    return 'date';
  }
  
  if (dataType === 'boolean') {
    return 'categorical';
  }
  
  if (dataType === 'numeric') {
    if (detectTimeSeriesColumn(name, values, dateColumns)) {
      return 'time_series_numeric';
    }
    return 'non_time_numeric';
  }
  
  if (dataType === 'categorical') {
    return 'categorical';
  }
  
  return 'text';
}

// Detect column data type with improved accuracy
export function detectColumnType(values: unknown[]): 'numeric' | 'categorical' | 'date' | 'boolean' | 'text' {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNullValues.length === 0) return 'text';
  
  const sampleSize = Math.min(nonNullValues.length, 200);
  const sample = nonNullValues.slice(0, sampleSize);
  
  // Check for boolean first
  const booleanMatch = sample.every(v => {
    const str = String(v).toLowerCase().trim();
    return [...BOOLEAN_VALUES.true, ...BOOLEAN_VALUES.false].includes(str);
  });
  if (booleanMatch && sample.length >= 2) return 'boolean';
  
  // Check for date - be more thorough
  let dateCount = 0;
  for (const v of sample) {
    const { date } = parseMultiFormatDate(v);
    if (date) dateCount++;
  }
  if (dateCount / sample.length >= 0.7) return 'date';
  
  // Check for numeric
  const numericCount = sample.filter(v => {
    const str = String(v).trim();
    if (str === '') return false;
    const num = Number(str.replace(/,/g, ''));
    return !isNaN(num);
  }).length;
  if (numericCount / sample.length >= 0.85) return 'numeric';
  
  // Check for categorical vs text
  const uniqueRatio = new Set(sample.map(v => String(v))).size / sample.length;
  if (uniqueRatio <= 0.3 || new Set(nonNullValues.map(v => String(v))).size <= 30) {
    return 'categorical';
  }
  
  return 'text';
}

// Determine column role for visualization
export function detectColumnRole(name: string, type: string, classification: ColumnClassification, uniqueRatio: number): 'dimension' | 'measure' | 'date' | 'identifier' {
  if (type === 'date' || classification === 'date') return 'date';
  if (classification === 'identifier') return 'identifier';
  
  if (classification === 'time_series_numeric' || classification === 'non_time_numeric') {
    const lowerName = name.toLowerCase();
    const dimensionPatterns = ['year', 'month', 'quarter', 'week', 'day', 'hour', 'minute'];
    if (dimensionPatterns.some(p => lowerName.includes(p)) && uniqueRatio < 0.05) {
      return 'dimension';
    }
    return 'measure';
  }
  
  return 'dimension';
}

// Calculate numeric statistics with skewness detection
export function calculateNumericStats(values: number[]): NumericStats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  if (n === 0) {
    return {
      min: 0, max: 0, mean: 0, median: 0, stdDev: 0,
      q1: 0, q3: 0, iqr: 0, outlierCount: 0, outliers: [],
      skewness: 0, isSkewed: false
    };
  }
  
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  
  const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  const median = n % 2 === 0 
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
    : sorted[Math.floor(n / 2)];
  
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  // Calculate skewness
  const skewness = stdDev > 0 
    ? (sorted.reduce((acc, val) => acc + Math.pow((val - mean) / stdDev, 3), 0) / n)
    : 0;
  const isSkewed = Math.abs(skewness) > 0.5;
  
  // Detect outliers using IQR
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  const outliers: { value: number; index: number }[] = [];
  values.forEach((val, idx) => {
    if (val < lowerBound || val > upperBound) {
      outliers.push({ value: val, index: idx });
    }
  });
  
  return {
    min: sorted[0],
    max: sorted[n - 1],
    mean,
    median,
    stdDev,
    q1,
    q3,
    iqr,
    outlierCount: outliers.length,
    outliers,
    skewness,
    isSkewed
  };
}

// Analyze categorical column with missing percentage
export function analyzeCategorical(values: string[], totalRows: number): CategoricalInfo {
  const valueCounts: Record<string, number> = {};
  const normalizedMappings: Record<string, string> = {};
  const inconsistentValues: string[] = [];
  let missingCount = 0;
  
  values.forEach(v => {
    if (v === null || v === undefined || v === '' || (typeof v === 'string' && v.trim() === '')) {
      missingCount++;
      return;
    }
    valueCounts[v] = (valueCounts[v] || 0) + 1;
  });
  
  const uniqueValues = Object.keys(valueCounts);
  const normalizedGroups: Map<string, string[]> = new Map();
  
  uniqueValues.forEach(val => {
    const normalized = val.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!normalizedGroups.has(normalized)) {
      normalizedGroups.set(normalized, []);
    }
    normalizedGroups.get(normalized)!.push(val);
  });
  
  // Common normalization mappings for gender, status, etc.
  const commonMappings: Record<string, string[]> = {
    'Male': ['m', 'male', 'man', 'boy', 'M', 'MALE', 'Male'],
    'Female': ['f', 'female', 'woman', 'girl', 'F', 'FEMALE', 'Female'],
    'Yes': ['y', 'yes', 'YES', 'Yes', 'true', 'TRUE', 'True', '1'],
    'No': ['n', 'no', 'NO', 'No', 'false', 'FALSE', 'False', '0'],
    'Active': ['active', 'ACTIVE', 'Active', 'enabled', 'on'],
    'Inactive': ['inactive', 'INACTIVE', 'Inactive', 'disabled', 'off'],
  };
  
  // Apply common mappings
  uniqueValues.forEach(val => {
    const lowerVal = val.toLowerCase().trim();
    for (const [canonical, variants] of Object.entries(commonMappings)) {
      if (variants.map(v => v.toLowerCase()).includes(lowerVal) && val !== canonical) {
        normalizedMappings[val] = canonical;
        if (!inconsistentValues.includes(val)) {
          inconsistentValues.push(val);
        }
      }
    }
  });
  
  // Find groups with multiple values (inconsistencies)
  normalizedGroups.forEach((group, _normalized) => {
    if (group.length > 1) {
      const canonical = group.sort((a, b) => {
        const countDiff = (valueCounts[b] || 0) - (valueCounts[a] || 0);
        if (countDiff !== 0) return countDiff;
        const aProper = a.charAt(0) === a.charAt(0).toUpperCase();
        const bProper = b.charAt(0) === b.charAt(0).toUpperCase();
        if (aProper && !bProper) return -1;
        if (bProper && !aProper) return 1;
        return a.localeCompare(b);
      })[0];
      
      group.forEach(val => {
        if (val !== canonical && !normalizedMappings[val]) {
          normalizedMappings[val] = canonical;
          if (!inconsistentValues.includes(val)) {
            inconsistentValues.push(val);
          }
        }
      });
    }
  });
  
  return {
    uniqueValues,
    valueCounts,
    normalizedMappings,
    inconsistentValues,
    missingPercentage: (missingCount / totalRows) * 100
  };
}

// Analyze date column with median calculation
export function analyzeDate(values: unknown[]): DateInfo {
  let minDate = new Date(8640000000000000);
  let maxDate = new Date(-8640000000000000);
  let invalidDates = 0;
  let format = 'unknown';
  const validDates: Date[] = [];
  const formatCounts: Record<string, number> = {};
  
  values.forEach(v => {
    if (v === null || v === undefined || v === '') return;
    
    const { date, format: fmt } = parseMultiFormatDate(v);
    
    if (date) {
      validDates.push(date);
      formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;
      if (date < minDate) minDate = date;
      if (date > maxDate) maxDate = date;
    } else {
      invalidDates++;
    }
  });
  
  // Determine most common format
  let maxCount = 0;
  Object.entries(formatCounts).forEach(([fmt, count]) => {
    if (count > maxCount) {
      maxCount = count;
      format = fmt;
    }
  });
  
  // Calculate median date
  let medianDate: Date | null = null;
  if (validDates.length > 0) {
    const sortedDates = [...validDates].sort((a, b) => a.getTime() - b.getTime());
    const midIndex = Math.floor(sortedDates.length / 2);
    medianDate = sortedDates.length % 2 === 0
      ? new Date((sortedDates[midIndex - 1].getTime() + sortedDates[midIndex].getTime()) / 2)
      : sortedDates[midIndex];
  }
  
  // Create date range string
  let dateRange = '';
  if (validDates.length > 0) {
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    dateRange = `${formatDate(minDate)} to ${formatDate(maxDate)}`;
  }
  
  return {
    minDate,
    maxDate,
    invalidDates,
    format,
    dateRange,
    validDates,
    medianDate
  };
}

// Profile a single column with enhanced classification
export function profileColumn(
  name: string, 
  values: unknown[], 
  dateColumns: string[] = []
): ColumnProfile {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '' && 
    (typeof v !== 'string' || v.trim() !== ''));
  
  const dataType = detectColumnType(values);
  const classification = classifyColumn(name, values, dataType, dateColumns);
  const uniqueValues = new Set(nonNullValues.map(v => String(v)));
  const uniqueRatio = uniqueValues.size / Math.max(nonNullValues.length, 1);
  
  const role = detectColumnRole(name, dataType, classification, uniqueRatio);
  const issues: ColumnIssue[] = [];
  
  const nullCount = values.length - nonNullValues.length;
  if (nullCount > 0) {
    issues.push({
      type: 'missing',
      count: nullCount,
      description: `${nullCount} missing values (${((nullCount / values.length) * 100).toFixed(1)}%)`
    });
  }
  
  let stats: NumericStats | undefined;
  let categoricalInfo: CategoricalInfo | undefined;
  let dateInfo: DateInfo | undefined;
  
  if (dataType === 'numeric') {
    const numericValues = nonNullValues
      .map(v => Number(String(v).replace(/,/g, '')))
      .filter(v => !isNaN(v));
    
    stats = calculateNumericStats(numericValues);
    
    if (stats.outlierCount > 0) {
      issues.push({
        type: 'outlier',
        count: stats.outlierCount,
        description: `${stats.outlierCount} outliers detected (IQR method)`
      });
    }
    
    const positiveOnlyPatterns = ['price', 'cost', 'amount', 'quantity', 'qty', 'count', 'age', 'revenue', 'sales', 'units', 'weight'];
    if (positiveOnlyPatterns.some(p => name.toLowerCase().includes(p)) && stats.min < 0) {
      issues.push({
        type: 'invalid_range',
        count: numericValues.filter(v => v < 0).length,
        description: `Unexpected negative values in "${name}"`
      });
    }
  }
  
  if (dataType === 'categorical' || dataType === 'text' || dataType === 'boolean') {
    const stringValues = nonNullValues.map(v => String(v));
    categoricalInfo = analyzeCategorical(stringValues, values.length);
    
    if (categoricalInfo.inconsistentValues.length > 0) {
      issues.push({
        type: 'inconsistent',
        count: categoricalInfo.inconsistentValues.length,
        description: `${categoricalInfo.inconsistentValues.length} inconsistent value variations`
      });
    }
    
    const encodingIssues = stringValues.filter(v => /[^\x00-\x7F]/.test(v) && /�|Ã|â€/.test(v));
    if (encodingIssues.length > 0) {
      issues.push({
        type: 'encoding',
        count: encodingIssues.length,
        description: `${encodingIssues.length} values with encoding issues`
      });
    }
  }
  
  if (dataType === 'date') {
    dateInfo = analyzeDate(values);
    
    if (dateInfo.invalidDates > 0) {
      issues.push({
        type: 'invalid_date',
        count: dateInfo.invalidDates,
        description: `${dateInfo.invalidDates} invalid date values`
      });
    }
  }
  
  const isTimeSeries = classification === 'time_series_numeric';
  const isDerived = classification === 'derived';
  
  return {
    name,
    originalName: name,
    dataType,
    classification,
    role,
    nullCount,
    uniqueCount: uniqueValues.size,
    sampleValues: Array.from(uniqueValues).slice(0, 5),
    stats,
    categoricalInfo,
    dateInfo,
    issues,
    isTimeSeries,
    isDerived
  };
}

// Detect dataset type based on column names and data patterns
export function detectDatasetType(columns: ColumnProfile[]): { type: DatasetProfile['type']; confidence: number } {
  const colNames = columns.map(c => c.name.toLowerCase());
  
  const patterns: Record<DatasetProfile['type'], string[]> = {
    sales: ['revenue', 'sales', 'order', 'product', 'customer', 'price', 'quantity', 'discount', 'profit', 'transaction', 'invoice'],
    hr: ['employee', 'salary', 'department', 'hire', 'manager', 'job', 'title', 'payroll', 'leave', 'attendance', 'join', 'staff'],
    finance: ['account', 'balance', 'debit', 'credit', 'transaction', 'payment', 'invoice', 'tax', 'budget', 'expense', 'ledger'],
    survey: ['response', 'rating', 'score', 'feedback', 'satisfaction', 'agree', 'disagree', 'opinion', 'survey', 'question', 'answer'],
    timeseries: ['timestamp', 'datetime', 'time', 'series', 'metric', 'value', 'measurement', 'sensor', 'reading', 'daily', 'monthly'],
    general: []
  };
  
  let bestMatch: DatasetProfile['type'] = 'general';
  let bestScore = 0;
  
  Object.entries(patterns).forEach(([type, keywords]) => {
    if (type === 'general') return;
    
    const score = keywords.filter(kw => 
      colNames.some(col => col.includes(kw))
    ).length;
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type as DatasetProfile['type'];
    }
  });
  
  const hasDateColumn = columns.some(c => c.dataType === 'date');
  const hasTimeSeriesMeasures = columns.some(c => c.isTimeSeries);
  
  if (hasDateColumn && hasTimeSeriesMeasures && bestScore < 2) {
    bestMatch = 'timeseries';
    bestScore = 2;
  }
  
  return {
    type: bestScore >= 2 ? bestMatch : 'general',
    confidence: Math.min(bestScore / 4, 1)
  };
}

// Suggest KPIs, filters, and drill-downs
export function suggestVisualizationFeatures(columns: ColumnProfile[]): {
  kpis: string[];
  filters: string[];
  drilldowns: string[];
} {
  const measures = columns.filter(c => c.role === 'measure');
  const dimensions = columns.filter(c => c.role === 'dimension');
  const dates = columns.filter(c => c.role === 'date');
  
  const kpis: string[] = [];
  const filters: string[] = [];
  const drilldowns: string[] = [];
  
  measures.forEach(m => {
    const name = m.name.toLowerCase();
    if (name.includes('revenue') || name.includes('sales') || name.includes('amount')) {
      kpis.push(`Total ${m.name}`);
      kpis.push(`Average ${m.name}`);
    } else if (name.includes('count') || name.includes('quantity')) {
      kpis.push(`Total ${m.name}`);
    } else if (name.includes('profit') || name.includes('margin')) {
      kpis.push(`Total ${m.name}`);
      kpis.push(`${m.name} %`);
    } else {
      kpis.push(`Sum of ${m.name}`);
    }
  });
  
  dimensions.forEach(d => {
    if (d.uniqueCount <= 25 && d.uniqueCount > 1) {
      filters.push(d.name);
    }
  });
  
  // Add "Unknown" as a filterable value indicator
  filters.push('(Includes "Unknown" for missing values)');
  
  dates.forEach(d => {
    drilldowns.push(`${d.name} (Year → Quarter → Month)`);
  });
  
  dimensions.forEach(d => {
    if (d.uniqueCount > 5 && d.uniqueCount <= 50) {
      drilldowns.push(d.name);
    }
  });
  
  return {
    kpis: kpis.slice(0, 6),
    filters: filters.slice(0, 6),
    drilldowns: drilldowns.slice(0, 4)
  };
}

// Generate data description for transparency
export function generateDataDescription(
  columns: ColumnProfile[], 
  rowCount: number,
  cleaningHighlights: string[]
): DataDescription {
  const dateColumns = columns.filter(c => c.dataType === 'date');
  const measureColumns = columns.filter(c => c.role === 'measure');
  const dimensionColumns = columns.filter(c => c.role === 'dimension');
  
  let dateRange: string | null = null;
  if (dateColumns.length > 0 && dateColumns[0].dateInfo?.dateRange) {
    dateRange = dateColumns[0].dateInfo.dateRange;
  }
  
  // Calculate data quality score (0-100)
  const totalIssues = columns.reduce((sum, c) => sum + c.issues.length, 0);
  const avgMissingRate = columns.reduce((sum, c) => sum + (c.nullCount / rowCount), 0) / columns.length;
  const qualityScore = Math.max(0, Math.min(100, 100 - (totalIssues * 5) - (avgMissingRate * 50)));
  
  const keyMetrics: string[] = [];
  measureColumns.slice(0, 4).forEach(m => {
    if (m.stats) {
      keyMetrics.push(`${m.name}: ${m.stats.min.toLocaleString()} - ${m.stats.max.toLocaleString()} (avg: ${m.stats.mean.toFixed(2)})`);
    }
  });
  
  return {
    rowCount,
    columnCount: columns.length,
    dateRange,
    timeColumns: dateColumns.map(c => c.name),
    measureColumns: measureColumns.map(c => c.name),
    dimensionColumns: dimensionColumns.map(c => c.name),
    keyMetrics,
    dataQualityScore: Math.round(qualityScore),
    cleaningHighlights
  };
}

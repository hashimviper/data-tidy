// Data analysis and profiling utilities

import { ColumnProfile, NumericStats, CategoricalInfo, DateInfo, ColumnIssue, DatasetProfile } from './dataTypes';

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/,                    // YYYY-MM-DD
  /^\d{2}\/\d{2}\/\d{4}$/,                  // MM/DD/YYYY
  /^\d{2}-\d{2}-\d{4}$/,                    // DD-MM-YYYY
  /^\d{4}\/\d{2}\/\d{2}$/,                  // YYYY/MM/DD
  /^\d{1,2}\s+\w{3,9}\s+\d{4}$/i,           // 1 Jan 2024
  /^\w{3,9}\s+\d{1,2},?\s+\d{4}$/i,         // Jan 1, 2024
];

const BOOLEAN_VALUES = {
  true: ['true', 'yes', '1', 'y', 't', 'on'],
  false: ['false', 'no', '0', 'n', 'f', 'off'],
};

// Detect column data type
export function detectColumnType(values: unknown[]): 'numeric' | 'categorical' | 'date' | 'boolean' | 'text' {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNullValues.length === 0) return 'text';
  
  // Sample values for type detection
  const sampleSize = Math.min(nonNullValues.length, 100);
  const sample = nonNullValues.slice(0, sampleSize);
  
  // Check for boolean
  const booleanMatch = sample.every(v => {
    const str = String(v).toLowerCase().trim();
    return [...BOOLEAN_VALUES.true, ...BOOLEAN_VALUES.false].includes(str);
  });
  if (booleanMatch && sample.length >= 2) return 'boolean';
  
  // Check for numeric
  const numericCount = sample.filter(v => !isNaN(Number(v)) && String(v).trim() !== '').length;
  if (numericCount / sample.length >= 0.9) return 'numeric';
  
  // Check for date
  const dateCount = sample.filter(v => {
    const str = String(v).trim();
    if (DATE_PATTERNS.some(p => p.test(str))) return true;
    const parsed = Date.parse(str);
    return !isNaN(parsed) && parsed > 0;
  }).length;
  if (dateCount / sample.length >= 0.8) return 'date';
  
  // Check for categorical vs text (categorical = limited unique values)
  const uniqueRatio = new Set(sample.map(v => String(v))).size / sample.length;
  if (uniqueRatio <= 0.3 || new Set(nonNullValues.map(v => String(v))).size <= 20) {
    return 'categorical';
  }
  
  return 'text';
}

// Determine column role for visualization
export function detectColumnRole(name: string, type: string, uniqueRatio: number): 'dimension' | 'measure' | 'date' | 'identifier' {
  const lowerName = name.toLowerCase();
  
  if (type === 'date') return 'date';
  
  // Check for identifier columns
  const idPatterns = ['id', '_id', 'key', 'code', 'number', 'num', 'no'];
  if (idPatterns.some(p => lowerName.includes(p)) && uniqueRatio > 0.9) {
    return 'identifier';
  }
  
  // Measures are numeric columns
  if (type === 'numeric') {
    const dimensionPatterns = ['year', 'month', 'quarter', 'week', 'day', 'age', 'count'];
    if (dimensionPatterns.some(p => lowerName.includes(p)) && uniqueRatio < 0.1) {
      return 'dimension';
    }
    return 'measure';
  }
  
  return 'dimension';
}

// Calculate numeric statistics
export function calculateNumericStats(values: number[]): NumericStats {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  if (n === 0) {
    return {
      min: 0, max: 0, mean: 0, median: 0, stdDev: 0,
      q1: 0, q3: 0, iqr: 0, outlierCount: 0, outliers: []
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
    outliers
  };
}

// Analyze categorical column
export function analyzeCategorical(values: string[]): CategoricalInfo {
  const valueCounts: Record<string, number> = {};
  const normalizedMappings: Record<string, string> = {};
  const inconsistentValues: string[] = [];
  
  // Count values
  values.forEach(v => {
    valueCounts[v] = (valueCounts[v] || 0) + 1;
  });
  
  // Detect similar values that should be normalized
  const uniqueValues = Object.keys(valueCounts);
  const normalizedGroups: Map<string, string[]> = new Map();
  
  uniqueValues.forEach(val => {
    const normalized = val.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!normalizedGroups.has(normalized)) {
      normalizedGroups.set(normalized, []);
    }
    normalizedGroups.get(normalized)!.push(val);
  });
  
  // Find groups with multiple values (inconsistencies)
  normalizedGroups.forEach((group, _normalized) => {
    if (group.length > 1) {
      // Use the most frequent or properly cased version as canonical
      const canonical = group.sort((a, b) => {
        const countDiff = (valueCounts[b] || 0) - (valueCounts[a] || 0);
        if (countDiff !== 0) return countDiff;
        // Prefer properly capitalized version
        const aProper = a.charAt(0) === a.charAt(0).toUpperCase();
        const bProper = b.charAt(0) === b.charAt(0).toUpperCase();
        if (aProper && !bProper) return -1;
        if (bProper && !aProper) return 1;
        return a.localeCompare(b);
      })[0];
      
      group.forEach(val => {
        if (val !== canonical) {
          normalizedMappings[val] = canonical;
          inconsistentValues.push(val);
        }
      });
    }
  });
  
  return {
    uniqueValues,
    valueCounts,
    normalizedMappings,
    inconsistentValues
  };
}

// Analyze date column
export function analyzeDate(values: unknown[]): DateInfo {
  let minDate = new Date(8640000000000000);
  let maxDate = new Date(-8640000000000000);
  let invalidDates = 0;
  let format = 'unknown';
  
  values.forEach(v => {
    if (v === null || v === undefined || v === '') return;
    
    const str = String(v).trim();
    let parsed: Date | null = null;
    
    // Try to detect format
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      format = 'YYYY-MM-DD';
      parsed = new Date(str);
    } else if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
      format = 'MM/DD/YYYY';
      const [m, d, y] = str.split('/');
      parsed = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    } else {
      parsed = new Date(str);
    }
    
    if (parsed && !isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
      if (parsed < minDate) minDate = parsed;
      if (parsed > maxDate) maxDate = parsed;
    } else {
      invalidDates++;
    }
  });
  
  return {
    minDate,
    maxDate,
    invalidDates,
    format
  };
}

// Profile a single column
export function profileColumn(name: string, values: unknown[]): ColumnProfile {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '' && 
    (typeof v !== 'string' || v.trim() !== ''));
  
  const dataType = detectColumnType(values);
  const uniqueValues = new Set(nonNullValues.map(v => String(v)));
  const uniqueRatio = uniqueValues.size / Math.max(nonNullValues.length, 1);
  
  const role = detectColumnRole(name, dataType, uniqueRatio);
  const issues: ColumnIssue[] = [];
  
  // Check for missing values
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
      .map(v => Number(v))
      .filter(v => !isNaN(v));
    
    stats = calculateNumericStats(numericValues);
    
    if (stats.outlierCount > 0) {
      issues.push({
        type: 'outlier',
        count: stats.outlierCount,
        description: `${stats.outlierCount} outliers detected (IQR method)`
      });
    }
    
    // Check for negative values in columns that shouldn't have them
    const positiveOnlyPatterns = ['price', 'cost', 'amount', 'quantity', 'qty', 'count', 'age', 'revenue', 'sales'];
    if (positiveOnlyPatterns.some(p => name.toLowerCase().includes(p)) && stats.min < 0) {
      issues.push({
        type: 'invalid_range',
        count: numericValues.filter(v => v < 0).length,
        description: `Unexpected negative values in "${name}"`
      });
    }
  }
  
  if (dataType === 'categorical' || dataType === 'text') {
    const stringValues = nonNullValues.map(v => String(v));
    categoricalInfo = analyzeCategorical(stringValues);
    
    if (categoricalInfo.inconsistentValues.length > 0) {
      issues.push({
        type: 'inconsistent',
        count: categoricalInfo.inconsistentValues.length,
        description: `${categoricalInfo.inconsistentValues.length} inconsistent value variations`
      });
    }
    
    // Check for encoding issues
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
        type: 'invalid_type',
        count: dateInfo.invalidDates,
        description: `${dateInfo.invalidDates} invalid date values`
      });
    }
  }
  
  return {
    name,
    originalName: name,
    dataType,
    role,
    nullCount,
    uniqueCount: uniqueValues.size,
    sampleValues: Array.from(uniqueValues).slice(0, 5),
    stats,
    categoricalInfo,
    dateInfo,
    issues
  };
}

// Detect dataset type based on column names and data patterns
export function detectDatasetType(columns: ColumnProfile[]): { type: DatasetProfile['type']; confidence: number } {
  const colNames = columns.map(c => c.name.toLowerCase());
  
  const patterns: Record<DatasetProfile['type'], string[]> = {
    sales: ['revenue', 'sales', 'order', 'product', 'customer', 'price', 'quantity', 'discount', 'profit', 'transaction'],
    hr: ['employee', 'salary', 'department', 'hire', 'manager', 'job', 'title', 'payroll', 'leave', 'attendance'],
    finance: ['account', 'balance', 'debit', 'credit', 'transaction', 'payment', 'invoice', 'tax', 'budget', 'expense'],
    survey: ['response', 'rating', 'score', 'feedback', 'satisfaction', 'agree', 'disagree', 'opinion', 'survey', 'question'],
    timeseries: ['timestamp', 'datetime', 'time', 'series', 'metric', 'value', 'measurement', 'sensor', 'reading'],
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
  
  // Check for time series by date column presence
  const hasDateColumn = columns.some(c => c.dataType === 'date');
  const hasMeasures = columns.filter(c => c.role === 'measure').length >= 1;
  if (hasDateColumn && hasMeasures && bestScore < 2) {
    bestMatch = 'timeseries';
    bestScore = 2;
  }
  
  return {
    type: bestScore >= 2 ? bestMatch : 'general',
    confidence: Math.min(bestScore / 4, 1)
  };
}

// Suggest KPIs, filters, and drill-downs based on profile
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
  
  // Suggest KPIs from measures
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
  
  // Suggest filters from dimensions
  dimensions.forEach(d => {
    if (d.uniqueCount <= 20) {
      filters.push(d.name);
    }
  });
  
  // Suggest drill-downs
  dates.forEach(d => {
    drilldowns.push(`${d.name} (Year → Quarter → Month)`);
  });
  
  dimensions.forEach(d => {
    if (d.uniqueCount > 5 && d.uniqueCount <= 50) {
      drilldowns.push(d.name);
    }
  });
  
  return {
    kpis: kpis.slice(0, 5),
    filters: filters.slice(0, 5),
    drilldowns: drilldowns.slice(0, 3)
  };
}

// Core types for the data preparation system

export interface DataQualityReport {
  totalRows: number;
  totalColumns: number;
  duplicateRows: number;
  missingValues: number;
  columnsWithMissing: string[];
  textColumnsToStandardize: string[];
  isClean: boolean;
  issues: string[];
}

export interface ColumnProfile {
  name: string;
  originalName: string;
  dataType: 'numeric' | 'categorical' | 'date' | 'boolean' | 'text';
  role: 'dimension' | 'measure' | 'date' | 'identifier';
  nullCount: number;
  uniqueCount: number;
  sampleValues: unknown[];
  stats?: NumericStats;
  categoricalInfo?: CategoricalInfo;
  dateInfo?: DateInfo;
  issues: ColumnIssue[];
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  q1: number;
  q3: number;
  iqr: number;
  outlierCount: number;
  outliers: { value: number; index: number }[];
}

export interface CategoricalInfo {
  uniqueValues: string[];
  valueCounts: Record<string, number>;
  normalizedMappings: Record<string, string>; // original -> normalized
  inconsistentValues: string[];
}

export interface DateInfo {
  minDate: Date;
  maxDate: Date;
  invalidDates: number;
  format: string;
}

export interface ColumnIssue {
  type: 'missing' | 'outlier' | 'inconsistent' | 'invalid_type' | 'invalid_range' | 'encoding';
  count: number;
  description: string;
}

export interface CleaningConfig {
  // Missing value handling
  numericImputation: 'mean' | 'median' | 'mode' | 'zero' | 'remove';
  categoricalImputation: 'mode' | 'unknown' | 'remove';
  
  // Outlier handling
  outlierDetection: 'iqr' | 'zscore' | 'none';
  outlierThreshold: number; // IQR multiplier or Z-score threshold
  outlierHandling: 'remove' | 'cap' | 'flag' | 'none';
  
  // Data standardization
  standardizeColumnNames: boolean;
  normalizeCategorical: boolean;
  trimWhitespace: boolean;
  
  // Type conversion
  autoConvertTypes: boolean;
  parseDates: boolean;
  
  // Range validation
  validateRanges: boolean;
  
  // Duplicates
  removeDuplicates: boolean;
  
  // Derived columns
  createDateParts: boolean;
}

export const DEFAULT_CLEANING_CONFIG: CleaningConfig = {
  numericImputation: 'median',
  categoricalImputation: 'unknown',
  outlierDetection: 'iqr',
  outlierThreshold: 1.5,
  outlierHandling: 'cap',
  standardizeColumnNames: true,
  normalizeCategorical: true,
  trimWhitespace: true,
  autoConvertTypes: true,
  parseDates: true,
  validateRanges: true,
  removeDuplicates: true,
  createDateParts: true,
};

export interface DatasetProfile {
  type: 'sales' | 'hr' | 'finance' | 'survey' | 'timeseries' | 'general';
  confidence: number;
  columns: ColumnProfile[];
  suggestedKpis: string[];
  suggestedFilters: string[];
  suggestedDrilldowns: string[];
}

export interface CleaningAction {
  type: string;
  column?: string;
  description: string;
  count: number;
  details?: string[];
}

export interface EnhancedCleaningResult {
  data: Record<string, unknown>[];
  originalData: Record<string, unknown>[];
  profile: DatasetProfile;
  config: CleaningConfig;
  actions: CleaningAction[];
  summary: CleaningSummary;
  derivedColumns: string[];
}

export interface CleaningSummary {
  rowsBefore: number;
  rowsAfter: number;
  columnsBefore: number;
  columnsAfter: number;
  duplicatesRemoved: number;
  missingValuesHandled: number;
  outliersHandled: number;
  columnsRenamed: number;
  categoricalNormalized: number;
  typesConverted: number;
  derivedColumnsCreated: number;
  totalChanges: number;
}

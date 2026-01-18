// Advanced data cleaning engine with zero-blank logic and time-series support

import {
  CleaningConfig,
  CleaningAction,
  EnhancedCleaningResult,
  CleaningSummary,
  DatasetProfile,
  DEFAULT_CLEANING_CONFIG,
  ColumnProfile
} from './dataTypes';
import {
  profileColumn,
  detectDatasetType,
  suggestVisualizationFeatures,
  parseMultiFormatDate,
  generateDataDescription
} from './dataAnalyzer';

type DataRow = Record<string, unknown>;

// Standardize column name to snake_case
function standardizeColumnName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

// Convert value to boolean
function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  
  const str = String(value).toLowerCase().trim();
  if (['true', 'yes', '1', 'y', 't', 'on', 'active', 'enabled'].includes(str)) return true;
  if (['false', 'no', '0', 'n', 'f', 'off', 'inactive', 'disabled'].includes(str)) return false;
  
  return null;
}

// Calculate median of numeric array
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Calculate mode of array
function mode<T>(values: T[]): T | undefined {
  if (values.length === 0) return undefined;
  
  const counts = new Map<T, number>();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  
  let maxCount = 0;
  let modeValue: T | undefined;
  
  counts.forEach((count, value) => {
    if (count > maxCount) {
      maxCount = count;
      modeValue = value;
    }
  });
  
  return modeValue;
}

// Linear interpolation for time-series data
function interpolateNumeric(values: (number | null)[]): number[] {
  const result = [...values] as number[];
  
  // Forward fill first
  for (let i = 1; i < result.length; i++) {
    if (result[i] === null && result[i - 1] !== null) {
      result[i] = result[i - 1] as number;
    }
  }
  
  // Backward fill
  for (let i = result.length - 2; i >= 0; i--) {
    if (result[i] === null && result[i + 1] !== null) {
      result[i] = result[i + 1] as number;
    }
  }
  
  // Linear interpolation for gaps in the middle
  for (let i = 0; i < result.length; i++) {
    if (result[i] === null) {
      let startIdx = i - 1;
      let endIdx = i + 1;
      
      while (startIdx >= 0 && result[startIdx] === null) startIdx--;
      while (endIdx < result.length && result[endIdx] === null) endIdx++;
      
      if (startIdx >= 0 && endIdx < result.length) {
        const startVal = result[startIdx] as number;
        const endVal = result[endIdx] as number;
        const steps = endIdx - startIdx;
        result[i] = startVal + ((endVal - startVal) * (i - startIdx)) / steps;
      }
    }
  }
  
  // If still null, use 0
  return result.map(v => v === null ? 0 : v);
}

// Forward fill for dates
function forwardFillDates(dates: (Date | null)[], medianDate: Date | null): Date[] {
  const result: Date[] = [];
  let lastValid: Date | null = null;
  
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] !== null) {
      lastValid = dates[i];
      result.push(dates[i]!);
    } else if (lastValid !== null) {
      result.push(lastValid);
    } else if (medianDate !== null) {
      result.push(medianDate);
    } else {
      result.push(new Date());
    }
  }
  
  return result;
}

// Backward fill for dates
function backwardFillDates(dates: (Date | null)[], medianDate: Date | null): Date[] {
  const result: Date[] = new Array(dates.length);
  let nextValid: Date | null = null;
  
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i] !== null) {
      nextValid = dates[i];
      result[i] = dates[i]!;
    } else if (nextValid !== null) {
      result[i] = nextValid;
    } else if (medianDate !== null) {
      result[i] = medianDate;
    } else {
      result[i] = new Date();
    }
  }
  
  return result;
}

// Check if value is empty/null/undefined
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

// Main cleaning function with enhanced logic
export function cleanDataAdvanced(
  data: DataRow[],
  config: Partial<CleaningConfig> = {}
): EnhancedCleaningResult {
  const fullConfig: CleaningConfig = { ...DEFAULT_CLEANING_CONFIG, ...config };
  const actions: CleaningAction[] = [];
  const cleaningHighlights: string[] = [];
  const originalData = data.map(row => ({ ...row }));
  
  if (data.length === 0) {
    return {
      data: [],
      originalData: [],
      profile: {
        type: 'general',
        confidence: 0,
        columns: [],
        suggestedKpis: [],
        suggestedFilters: [],
        suggestedDrilldowns: [],
        dataDescription: {
          rowCount: 0,
          columnCount: 0,
          dateRange: null,
          timeColumns: [],
          measureColumns: [],
          dimensionColumns: [],
          keyMetrics: [],
          dataQualityScore: 100,
          cleaningHighlights: []
        }
      },
      config: fullConfig,
      actions: [],
      summary: createEmptySummary(),
      derivedColumns: []
    };
  }
  
  let cleanedData = data.map(row => ({ ...row }));
  const originalColumns = Object.keys(data[0]);
  let columnMapping: Record<string, string> = {};
  let datesFixed = 0;
  let interpolatedValues = 0;
  
  // Step 1: Trim whitespace from all string values
  if (fullConfig.trimWhitespace) {
    let trimCount = 0;
    cleanedData = cleanedData.map(row => {
      const newRow: DataRow = {};
      Object.entries(row).forEach(([key, value]) => {
        if (typeof value === 'string') {
          const trimmed = value.trim().replace(/\s+/g, ' ');
          if (trimmed !== value) trimCount++;
          newRow[key] = trimmed;
        } else {
          newRow[key] = value;
        }
      });
      return newRow;
    });
    
    if (trimCount > 0) {
      actions.push({
        type: 'trim_whitespace',
        description: 'Trimmed whitespace from text values',
        count: trimCount
      });
      cleaningHighlights.push(`Cleaned ${trimCount} whitespace issues`);
    }
  }
  
  // Step 2: Standardize column names
  if (fullConfig.standardizeColumnNames) {
    const firstRow = cleanedData[0];
    const renamedCount: string[] = [];
    
    Object.keys(firstRow).forEach(col => {
      const standardized = standardizeColumnName(col);
      if (standardized !== col) {
        columnMapping[col] = standardized;
        renamedCount.push(`${col} → ${standardized}`);
      } else {
        columnMapping[col] = col;
      }
    });
    
    if (renamedCount.length > 0) {
      cleanedData = cleanedData.map(row => {
        const newRow: DataRow = {};
        Object.entries(row).forEach(([key, value]) => {
          newRow[columnMapping[key] || key] = value;
        });
        return newRow;
      });
      
      actions.push({
        type: 'rename_columns',
        description: 'Standardized column names to snake_case',
        count: renamedCount.length,
        details: renamedCount.slice(0, 10)
      });
      cleaningHighlights.push(`Renamed ${renamedCount.length} columns to snake_case`);
    }
  } else {
    Object.keys(cleanedData[0]).forEach(col => {
      columnMapping[col] = col;
    });
  }
  
  const columns = Object.keys(cleanedData[0]);
  
  // Step 3: Initial profile for type detection - detect date columns first
  const initialProfiles = columns.map(col => {
    const values = cleanedData.map(row => row[col]);
    return profileColumn(col, values, []);
  });
  
  const dateColumnNames = initialProfiles
    .filter(p => p.dataType === 'date')
    .map(p => p.name);
  
  // Re-profile with date context for time-series detection
  const columnProfiles = columns.map(col => {
    const values = cleanedData.map(row => row[col]);
    return profileColumn(col, values, dateColumnNames);
  });
  
  // Step 4: Remove duplicates
  if (fullConfig.removeDuplicates) {
    const seen = new Set<string>();
    const beforeCount = cleanedData.length;
    
    cleanedData = cleanedData.filter(row => {
      const key = JSON.stringify(row);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    const removedCount = beforeCount - cleanedData.length;
    if (removedCount > 0) {
      actions.push({
        type: 'remove_duplicates',
        description: 'Removed duplicate rows',
        count: removedCount
      });
      cleaningHighlights.push(`Removed ${removedCount} duplicate records`);
    }
  }
  
  // Step 5: Parse and fix dates with zero-blank logic
  if (fullConfig.parseDates) {
    const dateFixActions: string[] = [];
    
    columnProfiles.filter(p => p.dataType === 'date').forEach(profile => {
      const values = cleanedData.map(row => row[profile.name]);
      const parsedDates: (Date | null)[] = [];
      let fixedCount = 0;
      
      // First pass: parse all valid dates
      values.forEach(v => {
        const { date } = parseMultiFormatDate(v);
        parsedDates.push(date);
      });
      
      // Get median date for fallback
      const medianDate = profile.dateInfo?.medianDate || null;
      
      // Apply date imputation based on config
      let filledDates: Date[];
      if (fullConfig.dateImputation === 'forward_fill') {
        filledDates = forwardFillDates(parsedDates, medianDate);
      } else if (fullConfig.dateImputation === 'backward_fill') {
        filledDates = backwardFillDates(parsedDates, medianDate);
      } else {
        // median imputation
        filledDates = parsedDates.map(d => d || medianDate || new Date());
      }
      
      // Apply fixed dates
      cleanedData.forEach((row, idx) => {
        const originalVal = row[profile.name];
        const newDate = filledDates[idx];
        
        if (isEmpty(originalVal) || parsedDates[idx] === null) {
          row[profile.name] = newDate.toISOString().split('T')[0];
          fixedCount++;
          datesFixed++;
        } else if (parsedDates[idx]) {
          row[profile.name] = parsedDates[idx]!.toISOString().split('T')[0];
        }
      });
      
      if (fixedCount > 0) {
        dateFixActions.push(`${profile.name}: ${fixedCount} dates fixed/imputed`);
      }
    });
    
    if (dateFixActions.length > 0) {
      actions.push({
        type: 'fix_dates',
        description: 'Fixed and imputed invalid/missing dates',
        count: datesFixed,
        details: dateFixActions
      });
      cleaningHighlights.push(`Fixed ${datesFixed} date values using ${fullConfig.dateImputation} imputation`);
    }
  }
  
  // Step 6: Auto-convert data types
  if (fullConfig.autoConvertTypes) {
    let conversions = 0;
    const conversionDetails: string[] = [];
    
    columnProfiles.forEach(profile => {
      if (profile.dataType === 'numeric') {
        let converted = 0;
        cleanedData.forEach(row => {
          const val = row[profile.name];
          if (val !== null && val !== undefined && val !== '') {
            const strVal = String(val).replace(/,/g, '');
            const num = Number(strVal);
            if (!isNaN(num)) {
              row[profile.name] = num;
              if (typeof val === 'string') converted++;
            }
          }
        });
        if (converted > 0) {
          conversions += converted;
          conversionDetails.push(`${profile.name} → numeric`);
        }
      }
      
      if (profile.dataType === 'boolean') {
        let converted = 0;
        cleanedData.forEach(row => {
          const val = row[profile.name];
          const bool = parseBoolean(val);
          if (bool !== null) {
            row[profile.name] = bool;
            converted++;
          }
        });
        if (converted > 0) {
          conversions += converted;
          conversionDetails.push(`${profile.name} → boolean`);
        }
      }
    });
    
    if (conversionDetails.length > 0) {
      actions.push({
        type: 'convert_types',
        description: 'Converted data types',
        count: conversionDetails.length,
        details: conversionDetails
      });
    }
  }
  
  // Step 7: Normalize categorical values with GENDER DATA INTEGRITY RULE
  // Gender columns are treated as non-inferable - only explicit values are normalized
  if (fullConfig.normalizeCategorical) {
    const normalizations: string[] = [];
    
    // GENDER DATA INTEGRITY: Define protected column patterns
    const protectedColumnPatterns = ['gender', 'sex'];
    
    // STRICT gender mappings - ONLY these explicit values are valid
    const genderExplicitMappings: Record<string, string> = {
      'm': 'Male', 'male': 'Male', 'M': 'Male', 'MALE': 'Male', 'Male': 'Male',
      'f': 'Female', 'female': 'Female', 'F': 'Female', 'FEMALE': 'Female', 'Female': 'Female',
    };
    
    columnProfiles.forEach(profile => {
      if ((profile.dataType === 'categorical' || profile.dataType === 'text' || profile.dataType === 'boolean') && 
          profile.categoricalInfo) {
        
        const lowerColName = profile.name.toLowerCase();
        const isGenderColumn = protectedColumnPatterns.some(p => lowerColName.includes(p));
        
        let normalized = 0;
        
        if (isGenderColumn) {
          // GENDER DATA INTEGRITY RULE:
          // 1. Only normalize explicitly known values (M/male → Male, F/female → Female)
          // 2. Missing, invalid, or ambiguous values → "Unknown"
          // 3. NEVER infer gender from names, patterns, frequencies, or other columns
          // 4. "Unknown" remains a valid filterable category
          
          cleanedData.forEach(row => {
            const val = row[profile.name];
            const strVal = String(val || '').trim();
            
            if (isEmpty(val)) {
              // Missing → Unknown (no inference)
              row[profile.name] = 'Unknown';
              normalized++;
            } else if (genderExplicitMappings[strVal]) {
              // Explicit known value → normalize
              if (strVal !== genderExplicitMappings[strVal]) {
                row[profile.name] = genderExplicitMappings[strVal];
                normalized++;
              }
            } else {
              // Invalid/ambiguous value → Unknown (no inference)
              row[profile.name] = 'Unknown';
              normalized++;
            }
          });
          
          if (normalized > 0) {
            normalizations.push(`${profile.name}: ${normalized} values (gender integrity rule applied)`);
          }
        } else {
          // Standard normalization for non-protected columns
          const mappings = profile.categoricalInfo.normalizedMappings;
          
          cleanedData.forEach(row => {
            const val = String(row[profile.name] || '');
            if (mappings[val]) {
              row[profile.name] = mappings[val];
              normalized++;
            }
          });
          
          if (normalized > 0) {
            normalizations.push(`${profile.name}: ${normalized} values normalized`);
          }
        }
      }
    });
    
    if (normalizations.length > 0) {
      actions.push({
        type: 'normalize_categorical',
        description: 'Normalized categorical values (gender uses strict integrity rules)',
        count: normalizations.length,
        details: normalizations
      });
      cleaningHighlights.push(`Standardized ${normalizations.length} categorical columns`);
    }
  }
  
  // Step 8: Handle outliers
  if (fullConfig.outlierDetection !== 'none' && fullConfig.outlierHandling !== 'none') {
    const outlierActions: string[] = [];
    
    columnProfiles.forEach(profile => {
      if (profile.dataType === 'numeric' && profile.stats && profile.stats.outlierCount > 0) {
        const { q1, q3, iqr, mean, stdDev } = profile.stats;
        
        let lowerBound: number, upperBound: number;
        
        if (fullConfig.outlierDetection === 'iqr') {
          lowerBound = q1 - fullConfig.outlierThreshold * iqr;
          upperBound = q3 + fullConfig.outlierThreshold * iqr;
        } else {
          lowerBound = mean - fullConfig.outlierThreshold * stdDev;
          upperBound = mean + fullConfig.outlierThreshold * stdDev;
        }
        
        let handled = 0;
        
        if (fullConfig.outlierHandling === 'cap') {
          cleanedData.forEach(row => {
            const val = Number(row[profile.name]);
            if (!isNaN(val)) {
              if (val < lowerBound) {
                row[profile.name] = Math.round(lowerBound * 100) / 100;
                handled++;
              } else if (val > upperBound) {
                row[profile.name] = Math.round(upperBound * 100) / 100;
                handled++;
              }
            }
          });
        } else if (fullConfig.outlierHandling === 'remove') {
          const beforeCount = cleanedData.length;
          cleanedData = cleanedData.filter(row => {
            const val = Number(row[profile.name]);
            return isNaN(val) || (val >= lowerBound && val <= upperBound);
          });
          handled = beforeCount - cleanedData.length;
        } else if (fullConfig.outlierHandling === 'flag') {
          const flagCol = `${profile.name}_outlier`;
          cleanedData.forEach(row => {
            const val = Number(row[profile.name]);
            row[flagCol] = !isNaN(val) && (val < lowerBound || val > upperBound);
            if (row[flagCol]) handled++;
          });
        }
        
        if (handled > 0) {
          outlierActions.push(`${profile.name}: ${handled} ${fullConfig.outlierHandling === 'cap' ? 'capped' : fullConfig.outlierHandling === 'remove' ? 'removed' : 'flagged'}`);
        }
      }
    });
    
    if (outlierActions.length > 0) {
      actions.push({
        type: 'handle_outliers',
        description: `Handled outliers using ${fullConfig.outlierDetection.toUpperCase()} method`,
        count: outlierActions.length,
        details: outlierActions
      });
      cleaningHighlights.push(`Treated outliers in ${outlierActions.length} numeric columns`);
    }
  }
  
  // Step 9: Handle missing values with zero-blank logic
  const missingActions: string[] = [];
  
  columnProfiles.forEach(profile => {
    if (profile.nullCount === 0) return;
    
    const values = cleanedData.map(row => row[profile.name]);
    const nonNullValues = values.filter(v => !isEmpty(v));
    
    let fillValue: unknown;
    
    if (profile.dataType === 'numeric') {
      const numericValues = nonNullValues.map(v => Number(v)).filter(v => !isNaN(v));
      
      // Choose imputation method based on data characteristics
      if (profile.isTimeSeries && fullConfig.enableTimeSeriesInterpolation) {
        // Time-series interpolation
        const numericWithNulls = values.map(v => {
          if (isEmpty(v)) return null;
          const num = Number(v);
          return isNaN(num) ? null : num;
        });
        
        const interpolated = interpolateNumeric(numericWithNulls);
        let interpCount = 0;
        
        cleanedData.forEach((row, idx) => {
          if (isEmpty(row[profile.name])) {
            row[profile.name] = Math.round(interpolated[idx] * 100) / 100;
            interpCount++;
            interpolatedValues++;
          }
        });
        
        if (interpCount > 0) {
          missingActions.push(`${profile.name}: ${interpCount} → interpolated (time-series)`);
        }
        return; // Skip normal imputation
      }
      
      // Non-time-series: use skewness to decide
      const isSkewed = profile.stats?.isSkewed || false;
      
      switch (fullConfig.numericImputation) {
        case 'mean':
          fillValue = numericValues.length > 0 
            ? Math.round((numericValues.reduce((a, b) => a + b, 0) / numericValues.length) * 100) / 100
            : 0;
          break;
        case 'median':
          fillValue = median(numericValues);
          break;
        case 'mode':
          fillValue = mode(numericValues) ?? 0;
          break;
        case 'zero':
          fillValue = 0;
          break;
        case 'interpolate':
          // Fall back to median for non-time-series
          fillValue = median(numericValues);
          break;
        case 'remove':
          break;
      }
      
      // Smart fallback: if skewed, prefer median even if mean was selected
      if (isSkewed && fullConfig.numericImputation === 'mean') {
        fillValue = median(numericValues);
      }
    } else if (profile.dataType === 'categorical' || profile.dataType === 'text') {
      const missingPct = profile.categoricalInfo?.missingPercentage || 0;
      
      // If missing percentage is high (>30%), use "Unknown"
      // Otherwise use mode
      if (missingPct > 30 || fullConfig.categoricalImputation === 'unknown') {
        fillValue = 'Unknown';
      } else {
        fillValue = mode(nonNullValues.map(v => String(v))) ?? 'Unknown';
      }
    } else if (profile.dataType === 'boolean') {
      fillValue = false;
    }
    
    // Apply fill value with zero-blank enforcement
    if (fillValue !== undefined && fullConfig.enforceZeroBlank) {
      let filled = 0;
      cleanedData.forEach(row => {
        if (isEmpty(row[profile.name])) {
          row[profile.name] = fillValue;
          filled++;
        }
      });
      
      if (filled > 0) {
        missingActions.push(`${profile.name}: ${filled} → ${String(fillValue).substring(0, 20)}`);
      }
    }
  });
  
  // Handle remove option for missing values
  if (fullConfig.numericImputation === 'remove' || fullConfig.categoricalImputation === 'remove') {
    const beforeCount = cleanedData.length;
    cleanedData = cleanedData.filter(row => {
      return !Object.values(row).some(v => isEmpty(v));
    });
    const removedCount = beforeCount - cleanedData.length;
    if (removedCount > 0) {
      missingActions.push(`Removed ${removedCount} rows with missing values`);
    }
  }
  
  if (missingActions.length > 0) {
    actions.push({
      type: 'handle_missing',
      description: 'Handled missing values intelligently',
      count: missingActions.length,
      details: missingActions
    });
    cleaningHighlights.push(`Imputed missing values in ${missingActions.length} columns`);
  }
  
  // Step 10: Create derived date columns with zero-blank guarantee
  const derivedColumns: string[] = [];
  
  if (fullConfig.createDateParts) {
    const dateProfiles = columnProfiles.filter(p => p.dataType === 'date');
    
    dateProfiles.forEach(profile => {
      const yearCol = `${profile.name}_year`;
      const quarterCol = `${profile.name}_quarter`;
      const monthCol = `${profile.name}_month`;
      const monthNameCol = `${profile.name}_month_name`;
      const dayOfWeekCol = `${profile.name}_day_of_week`;
      
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      // Get fallback values from median date
      const medianDate = profile.dateInfo?.medianDate || new Date();
      const fallbackYear = medianDate.getFullYear();
      const fallbackQuarter = `Q${Math.floor(medianDate.getMonth() / 3) + 1}`;
      const fallbackMonth = medianDate.getMonth() + 1;
      const fallbackMonthName = monthNames[medianDate.getMonth()];
      const fallbackDayOfWeek = dayNames[medianDate.getDay()];
      
      cleanedData.forEach(row => {
        const val = row[profile.name];
        const { date } = parseMultiFormatDate(val);
        
        if (date) {
          row[yearCol] = date.getFullYear();
          row[quarterCol] = `Q${Math.floor(date.getMonth() / 3) + 1}`;
          row[monthCol] = date.getMonth() + 1;
          row[monthNameCol] = monthNames[date.getMonth()];
          row[dayOfWeekCol] = dayNames[date.getDay()];
        } else {
          // Zero-blank rule: use fallback values
          row[yearCol] = fallbackYear;
          row[quarterCol] = fallbackQuarter;
          row[monthCol] = fallbackMonth;
          row[monthNameCol] = fallbackMonthName;
          row[dayOfWeekCol] = fallbackDayOfWeek;
        }
      });
      
      derivedColumns.push(yearCol, quarterCol, monthCol, monthNameCol, dayOfWeekCol);
    });
    
    if (derivedColumns.length > 0) {
      actions.push({
        type: 'create_derived',
        description: 'Created derived date columns (Year, Quarter, Month, Day of Week)',
        count: derivedColumns.length,
        details: derivedColumns
      });
      cleaningHighlights.push(`Created ${derivedColumns.length} derived date fields`);
    }
  }
  
  // Step 11: Validate ranges
  if (fullConfig.validateRanges) {
    const rangeIssues: string[] = [];
    
    columnProfiles.forEach(profile => {
      if (profile.dataType === 'numeric') {
        const name = profile.name.toLowerCase();
        
        // Check for negative values where not expected
        const shouldBePositive = ['price', 'cost', 'amount', 'quantity', 'qty', 'count', 
          'age', 'revenue', 'sales', 'units', 'weight', 'height', 'width', 'length', 'salary']
          .some(p => name.includes(p));
        
        if (shouldBePositive) {
          let corrected = 0;
          cleanedData.forEach(row => {
            const val = Number(row[profile.name]);
            if (!isNaN(val) && val < 0) {
              row[profile.name] = Math.abs(val);
              corrected++;
            }
          });
          
          if (corrected > 0) {
            rangeIssues.push(`${profile.name}: ${corrected} negative → positive`);
          }
        }
        
        // Check for percentages > 100
        if (name.includes('percent') || name.includes('pct') || name.includes('rate')) {
          let corrected = 0;
          cleanedData.forEach(row => {
            const val = Number(row[profile.name]);
            if (!isNaN(val) && val > 100) {
              row[profile.name] = 100;
              corrected++;
            }
          });
          
          if (corrected > 0) {
            rangeIssues.push(`${profile.name}: ${corrected} values capped at 100%`);
          }
        }
        
        // Check for age constraints
        if (name.includes('age')) {
          let corrected = 0;
          cleanedData.forEach(row => {
            const val = Number(row[profile.name]);
            if (!isNaN(val)) {
              if (val > 120) {
                row[profile.name] = 120;
                corrected++;
              } else if (val < 0) {
                row[profile.name] = 0;
                corrected++;
              }
            }
          });
          
          if (corrected > 0) {
            rangeIssues.push(`${profile.name}: ${corrected} ages constrained to 0-120`);
          }
        }
      }
    });
    
    if (rangeIssues.length > 0) {
      actions.push({
        type: 'validate_ranges',
        description: 'Validated and corrected value ranges',
        count: rangeIssues.length,
        details: rangeIssues
      });
      cleaningHighlights.push(`Fixed range issues in ${rangeIssues.length} columns`);
    }
  }
  
  // Step 12: Final zero-blank check - ensure no empty values remain
  if (fullConfig.enforceZeroBlank) {
    let blanksFixed = 0;
    
    cleanedData.forEach(row => {
      Object.keys(row).forEach(key => {
        if (isEmpty(row[key])) {
          // Determine appropriate default based on existing values
          const existingProfile = columnProfiles.find(p => p.name === key);
          if (existingProfile) {
            if (existingProfile.dataType === 'numeric') {
              row[key] = 0;
            } else if (existingProfile.dataType === 'date') {
              row[key] = new Date().toISOString().split('T')[0];
            } else {
              row[key] = 'Unknown';
            }
          } else {
            row[key] = 'Unknown';
          }
          blanksFixed++;
        }
      });
    });
    
    if (blanksFixed > 0) {
      actions.push({
        type: 'zero_blank_enforcement',
        description: 'Applied zero-blank rule to remaining empty values',
        count: blanksFixed
      });
    }
  }
  
  // Re-profile cleaned data
  const finalColumns = Object.keys(cleanedData[0] || {});
  const finalProfiles = finalColumns.map(col => {
    const values = cleanedData.map(row => row[col]);
    return profileColumn(col, values, dateColumnNames);
  });
  
  // Detect dataset type and suggest visualization features
  const { type: datasetType, confidence } = detectDatasetType(finalProfiles);
  const { kpis, filters, drilldowns } = suggestVisualizationFeatures(finalProfiles);
  const dataDescription = generateDataDescription(finalProfiles, cleanedData.length, cleaningHighlights);
  
  // Create summary
  const summary: CleaningSummary = {
    rowsBefore: originalData.length,
    rowsAfter: cleanedData.length,
    columnsBefore: originalColumns.length,
    columnsAfter: finalColumns.length,
    duplicatesRemoved: actions.find(a => a.type === 'remove_duplicates')?.count || 0,
    missingValuesHandled: actions.find(a => a.type === 'handle_missing')?.count || 0,
    outliersHandled: actions.find(a => a.type === 'handle_outliers')?.count || 0,
    columnsRenamed: actions.find(a => a.type === 'rename_columns')?.count || 0,
    categoricalNormalized: actions.find(a => a.type === 'normalize_categorical')?.count || 0,
    typesConverted: actions.find(a => a.type === 'convert_types')?.count || 0,
    derivedColumnsCreated: derivedColumns.length,
    datesFixed,
    interpolatedValues,
    totalChanges: actions.reduce((sum, a) => sum + a.count, 0)
  };
  
  return {
    data: cleanedData,
    originalData,
    profile: {
      type: datasetType,
      confidence,
      columns: finalProfiles,
      suggestedKpis: kpis,
      suggestedFilters: filters,
      suggestedDrilldowns: drilldowns,
      dataDescription
    },
    config: fullConfig,
    actions,
    summary,
    derivedColumns
  };
}

function createEmptySummary(): CleaningSummary {
  return {
    rowsBefore: 0,
    rowsAfter: 0,
    columnsBefore: 0,
    columnsAfter: 0,
    duplicatesRemoved: 0,
    missingValuesHandled: 0,
    outliersHandled: 0,
    columnsRenamed: 0,
    categoricalNormalized: 0,
    typesConverted: 0,
    derivedColumnsCreated: 0,
    datesFixed: 0,
    interpolatedValues: 0,
    totalChanges: 0
  };
}

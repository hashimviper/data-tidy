// Advanced data cleaning engine

import {
  CleaningConfig,
  CleaningAction,
  EnhancedCleaningResult,
  CleaningSummary,
  DatasetProfile,
  DEFAULT_CLEANING_CONFIG
} from './dataTypes';
import {
  profileColumn,
  detectDatasetType,
  suggestVisualizationFeatures
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

// Parse date string to Date object
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  const str = String(value).trim();
  if (!str) return null;
  
  // Try ISO format first
  let parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
    return parsed;
  }
  
  // Try MM/DD/YYYY
  const mdyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    parsed = new Date(parseInt(mdyMatch[3]), parseInt(mdyMatch[1]) - 1, parseInt(mdyMatch[2]));
    if (!isNaN(parsed.getTime())) return parsed;
  }
  
  // Try DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    parsed = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
    if (!isNaN(parsed.getTime())) return parsed;
  }
  
  return null;
}

// Convert value to boolean
function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  
  const str = String(value).toLowerCase().trim();
  if (['true', 'yes', '1', 'y', 't', 'on'].includes(str)) return true;
  if (['false', 'no', '0', 'n', 'f', 'off'].includes(str)) return false;
  
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

// Main cleaning function
export function cleanDataAdvanced(
  data: DataRow[],
  config: Partial<CleaningConfig> = {}
): EnhancedCleaningResult {
  const fullConfig: CleaningConfig = { ...DEFAULT_CLEANING_CONFIG, ...config };
  const actions: CleaningAction[] = [];
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
        suggestedDrilldowns: []
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
    }
  } else {
    Object.keys(cleanedData[0]).forEach(col => {
      columnMapping[col] = col;
    });
  }
  
  const columns = Object.keys(cleanedData[0]);
  
  // Step 3: Profile columns for type detection
  const columnProfiles = columns.map(col => {
    const values = cleanedData.map(row => row[col]);
    return profileColumn(col, values);
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
    }
  }
  
  // Step 5: Auto-convert data types
  if (fullConfig.autoConvertTypes) {
    let conversions = 0;
    const conversionDetails: string[] = [];
    
    columnProfiles.forEach(profile => {
      if (profile.dataType === 'numeric') {
        let converted = 0;
        cleanedData.forEach(row => {
          const val = row[profile.name];
          if (val !== null && val !== undefined && val !== '') {
            const num = Number(val);
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
      
      if (profile.dataType === 'date' && fullConfig.parseDates) {
        let converted = 0;
        cleanedData.forEach(row => {
          const val = row[profile.name];
          const date = parseDate(val);
          if (date) {
            row[profile.name] = date.toISOString().split('T')[0];
            converted++;
          }
        });
        if (converted > 0) {
          conversions += converted;
          conversionDetails.push(`${profile.name} → date`);
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
  
  // Step 6: Normalize categorical values
  if (fullConfig.normalizeCategorical) {
    const normalizations: string[] = [];
    
    columnProfiles.forEach(profile => {
      if ((profile.dataType === 'categorical' || profile.dataType === 'text') && 
          profile.categoricalInfo?.inconsistentValues.length) {
        const mappings = profile.categoricalInfo.normalizedMappings;
        let normalized = 0;
        
        cleanedData.forEach(row => {
          const val = String(row[profile.name] || '');
          if (mappings[val]) {
            row[profile.name] = mappings[val];
            normalized++;
          }
        });
        
        if (normalized > 0) {
          normalizations.push(`${profile.name}: ${normalized} values`);
        }
      }
    });
    
    if (normalizations.length > 0) {
      actions.push({
        type: 'normalize_categorical',
        description: 'Normalized inconsistent categorical values',
        count: normalizations.length,
        details: normalizations
      });
    }
  }
  
  // Step 7: Handle outliers
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
          // Z-score
          lowerBound = mean - fullConfig.outlierThreshold * stdDev;
          upperBound = mean + fullConfig.outlierThreshold * stdDev;
        }
        
        let handled = 0;
        
        if (fullConfig.outlierHandling === 'cap') {
          cleanedData.forEach(row => {
            const val = Number(row[profile.name]);
            if (!isNaN(val)) {
              if (val < lowerBound) {
                row[profile.name] = lowerBound;
                handled++;
              } else if (val > upperBound) {
                row[profile.name] = upperBound;
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
          outlierActions.push(`${profile.name}: ${handled} values ${fullConfig.outlierHandling === 'cap' ? 'capped' : fullConfig.outlierHandling === 'remove' ? 'removed' : 'flagged'}`);
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
    }
  }
  
  // Step 8: Handle missing values
  const missingActions: string[] = [];
  
  columnProfiles.forEach(profile => {
    if (profile.nullCount === 0) return;
    
    const values = cleanedData.map(row => row[profile.name]);
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '' &&
      (typeof v !== 'string' || v.trim() !== ''));
    
    let fillValue: unknown;
    
    if (profile.dataType === 'numeric') {
      const numericValues = nonNullValues.map(v => Number(v)).filter(v => !isNaN(v));
      
      switch (fullConfig.numericImputation) {
        case 'mean':
          fillValue = numericValues.length > 0 
            ? numericValues.reduce((a, b) => a + b, 0) / numericValues.length 
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
        case 'remove':
          // Handle below
          break;
      }
    } else if (profile.dataType === 'categorical' || profile.dataType === 'text') {
      switch (fullConfig.categoricalImputation) {
        case 'mode':
          fillValue = mode(nonNullValues.map(v => String(v))) ?? 'Unknown';
          break;
        case 'unknown':
          fillValue = 'Unknown';
          break;
        case 'remove':
          // Handle below
          break;
      }
    } else if (profile.dataType === 'boolean') {
      fillValue = false;
    }
    
    if (fillValue !== undefined) {
      let filled = 0;
      cleanedData.forEach(row => {
        const val = row[profile.name];
        if (val === null || val === undefined || val === '' ||
            (typeof val === 'string' && val.trim() === '')) {
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
      return !Object.values(row).some(v => 
        v === null || v === undefined || v === '' || (typeof v === 'string' && v.trim() === '')
      );
    });
    const removedCount = beforeCount - cleanedData.length;
    if (removedCount > 0) {
      missingActions.push(`Removed ${removedCount} rows with missing values`);
    }
  }
  
  if (missingActions.length > 0) {
    actions.push({
      type: 'handle_missing',
      description: 'Handled missing values',
      count: missingActions.length,
      details: missingActions
    });
  }
  
  // Step 9: Create derived date columns
  const derivedColumns: string[] = [];
  
  if (fullConfig.createDateParts) {
    columnProfiles
      .filter(p => p.dataType === 'date')
      .forEach(profile => {
        const hasDateValues = cleanedData.some(row => {
          const val = row[profile.name];
          return val && (val instanceof Date || !isNaN(Date.parse(String(val))));
        });
        
        if (hasDateValues) {
          const yearCol = `${profile.name}_year`;
          const quarterCol = `${profile.name}_quarter`;
          const monthCol = `${profile.name}_month`;
          const monthNameCol = `${profile.name}_month_name`;
          const dayOfWeekCol = `${profile.name}_day_of_week`;
          
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          
          cleanedData.forEach(row => {
            const val = row[profile.name];
            const date = parseDate(val);
            
            if (date) {
              row[yearCol] = date.getFullYear();
              row[quarterCol] = `Q${Math.floor(date.getMonth() / 3) + 1}`;
              row[monthCol] = date.getMonth() + 1;
              row[monthNameCol] = monthNames[date.getMonth()];
              row[dayOfWeekCol] = dayNames[date.getDay()];
            }
          });
          
          derivedColumns.push(yearCol, quarterCol, monthCol, monthNameCol, dayOfWeekCol);
        }
      });
    
    if (derivedColumns.length > 0) {
      actions.push({
        type: 'create_derived',
        description: 'Created derived date columns',
        count: derivedColumns.length,
        details: derivedColumns
      });
    }
  }
  
  // Step 10: Validate ranges
  if (fullConfig.validateRanges) {
    const rangeIssues: string[] = [];
    
    columnProfiles.forEach(profile => {
      if (profile.dataType === 'numeric') {
        const name = profile.name.toLowerCase();
        
        // Check for negative values where not expected
        const shouldBePositive = ['price', 'cost', 'amount', 'quantity', 'qty', 'count', 
          'age', 'revenue', 'sales', 'units', 'weight', 'height', 'width', 'length']
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
            rangeIssues.push(`${profile.name}: ${corrected} negative values converted to positive`);
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
      }
    });
    
    if (rangeIssues.length > 0) {
      actions.push({
        type: 'validate_ranges',
        description: 'Validated and corrected value ranges',
        count: rangeIssues.length,
        details: rangeIssues
      });
    }
  }
  
  // Re-profile cleaned data
  const finalColumns = Object.keys(cleanedData[0] || {});
  const finalProfiles = finalColumns.map(col => {
    const values = cleanedData.map(row => row[col]);
    return profileColumn(col, values);
  });
  
  // Detect dataset type and suggest visualization features
  const { type: datasetType, confidence } = detectDatasetType(finalProfiles);
  const { kpis, filters, drilldowns } = suggestVisualizationFeatures(finalProfiles);
  
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
      suggestedDrilldowns: drilldowns
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
    totalChanges: 0
  };
}

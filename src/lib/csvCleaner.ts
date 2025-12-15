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

export interface CleaningResult {
  data: Record<string, unknown>[];
  report: DataQualityReport;
  cleanedReport: DataQualityReport;
  changesApplied: string[];
}

// Analyze data quality without modifying data
export function analyzeDataQuality(data: Record<string, unknown>[]): DataQualityReport {
  if (data.length === 0) {
    return {
      totalRows: 0,
      totalColumns: 0,
      duplicateRows: 0,
      missingValues: 0,
      columnsWithMissing: [],
      textColumnsToStandardize: [],
      isClean: true,
      issues: [],
    };
  }

  const columns = Object.keys(data[0]);
  const issues: string[] = [];

  // Count duplicates
  const seen = new Set<string>();
  let duplicateRows = 0;
  data.forEach((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      duplicateRows++;
    } else {
      seen.add(key);
    }
  });

  if (duplicateRows > 0) {
    issues.push(`${duplicateRows} duplicate row(s) found`);
  }

  // Count missing values
  let missingValues = 0;
  const columnsWithMissing: string[] = [];
  
  columns.forEach((col) => {
    let colMissing = 0;
    data.forEach((row) => {
      const value = row[col];
      if (value === null || value === undefined || value === '' || 
          (typeof value === 'string' && value.trim() === '')) {
        colMissing++;
        missingValues++;
      }
    });
    if (colMissing > 0) {
      columnsWithMissing.push(`${col} (${colMissing})`);
    }
  });

  if (missingValues > 0) {
    issues.push(`${missingValues} missing value(s) in ${columnsWithMissing.length} column(s)`);
  }

  // Check for text columns needing standardization
  const textColumnsToStandardize: string[] = [];
  columns.forEach((col) => {
    let needsStandardization = false;
    data.forEach((row) => {
      const value = row[col];
      if (typeof value === 'string') {
        // Check for leading/trailing whitespace or inconsistent casing issues
        if (value !== value.trim() || /\s{2,}/.test(value)) {
          needsStandardization = true;
        }
      }
    });
    if (needsStandardization) {
      textColumnsToStandardize.push(col);
    }
  });

  if (textColumnsToStandardize.length > 0) {
    issues.push(`${textColumnsToStandardize.length} column(s) have text formatting issues`);
  }

  return {
    totalRows: data.length,
    totalColumns: columns.length,
    duplicateRows,
    missingValues,
    columnsWithMissing,
    textColumnsToStandardize,
    isClean: issues.length === 0,
    issues,
  };
}

// Clean data based on detected issues
export function cleanData(data: Record<string, unknown>[]): CleaningResult {
  const originalReport = analyzeDataQuality(data);
  
  if (originalReport.isClean) {
    return {
      data,
      report: originalReport,
      cleanedReport: originalReport,
      changesApplied: [],
    };
  }

  let cleanedData = [...data];
  const changesApplied: string[] = [];

  // Step 1: Remove duplicate rows
  if (originalReport.duplicateRows > 0) {
    const seen = new Set<string>();
    const uniqueData: Record<string, unknown>[] = [];
    cleanedData.forEach((row) => {
      const key = JSON.stringify(row);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(row);
      }
    });
    cleanedData = uniqueData;
    changesApplied.push(`Removed ${originalReport.duplicateRows} duplicate row(s)`);
  }

  // Step 2: Handle missing values (fill with appropriate defaults)
  if (originalReport.missingValues > 0) {
    const columns = Object.keys(cleanedData[0] || {});
    let filledCount = 0;

    columns.forEach((col) => {
      // Determine column type by sampling non-empty values
      const nonEmptyValues = cleanedData
        .map((row) => row[col])
        .filter((v) => v !== null && v !== undefined && v !== '' && 
                      (typeof v !== 'string' || v.trim() !== ''));

      const isNumeric = nonEmptyValues.length > 0 && 
        nonEmptyValues.every((v) => !isNaN(Number(v)));

      cleanedData = cleanedData.map((row) => {
        const value = row[col];
        const isEmpty = value === null || value === undefined || value === '' ||
                       (typeof value === 'string' && value.trim() === '');
        
        if (isEmpty) {
          filledCount++;
          if (isNumeric) {
            // For numeric columns, use median
            const numericValues = nonEmptyValues.map(Number).sort((a, b) => a - b);
            const median = numericValues.length > 0 
              ? numericValues[Math.floor(numericValues.length / 2)] 
              : 0;
            return { ...row, [col]: median };
          } else {
            // For text columns, use "Unknown" or most common value
            return { ...row, [col]: 'Unknown' };
          }
        }
        return row;
      });
    });

    if (filledCount > 0) {
      changesApplied.push(`Filled ${filledCount} missing value(s)`);
    }
  }

  // Step 3: Standardize text (trim whitespace, normalize spaces)
  if (originalReport.textColumnsToStandardize.length > 0) {
    let standardizedCount = 0;

    cleanedData = cleanedData.map((row) => {
      const newRow = { ...row };
      originalReport.textColumnsToStandardize.forEach((col) => {
        const value = row[col];
        if (typeof value === 'string') {
          const standardized = value.trim().replace(/\s{2,}/g, ' ');
          if (standardized !== value) {
            standardizedCount++;
            newRow[col] = standardized;
          }
        }
      });
      return newRow;
    });

    if (standardizedCount > 0) {
      changesApplied.push(`Standardized text in ${standardizedCount} cell(s)`);
    }
  }

  const cleanedReport = analyzeDataQuality(cleanedData);

  return {
    data: cleanedData,
    report: originalReport,
    cleanedReport,
    changesApplied,
  };
}

// Convert data to CSV string for download
export function dataToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const columns = Object.keys(data[0]);
  const header = columns.map((col) => `"${col.replace(/"/g, '""')}"`).join(',');
  
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        return `"${stringValue.replace(/"/g, '""')}"`;
      })
      .join(',')
  );

  return [header, ...rows].join('\n');
}

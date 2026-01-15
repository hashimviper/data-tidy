// Data export utilities

import * as XLSX from 'xlsx';
import { EnhancedCleaningResult } from './dataTypes';

type DataRow = Record<string, unknown>;

// Convert data to CSV string
export function dataToCSV(data: DataRow[]): string {
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

// Convert data to Excel blob
export function dataToExcel(data: DataRow[], sheetName = 'Data'): Blob {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

// Convert data to JSON string
export function dataToJSON(data: DataRow[], pretty = true): string {
  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

// Generate cleaning report as text
export function generateCleaningReport(result: EnhancedCleaningResult, fileName: string): string {
  const { summary, actions, profile, config } = result;
  const lines: string[] = [];
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    DATA CLEANING REPORT                        ');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`File: ${fileName}`);
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push(`Dataset Type: ${profile.type.toUpperCase()} (${(profile.confidence * 100).toFixed(0)}% confidence)`);
  lines.push('');
  
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('SUMMARY');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`Rows:        ${summary.rowsBefore.toLocaleString()} → ${summary.rowsAfter.toLocaleString()} (${summary.rowsBefore - summary.rowsAfter} removed)`);
  lines.push(`Columns:     ${summary.columnsBefore} → ${summary.columnsAfter} (${summary.columnsAfter - summary.columnsBefore} added)`);
  lines.push(`Total Changes: ${summary.totalChanges.toLocaleString()}`);
  lines.push('');
  
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('CLEANING CONFIGURATION');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`Numeric Imputation:    ${config.numericImputation}`);
  lines.push(`Categorical Imputation: ${config.categoricalImputation}`);
  lines.push(`Outlier Detection:     ${config.outlierDetection} (threshold: ${config.outlierThreshold})`);
  lines.push(`Outlier Handling:      ${config.outlierHandling}`);
  lines.push(`Standardize Columns:   ${config.standardizeColumnNames ? 'Yes' : 'No'}`);
  lines.push(`Normalize Categories:  ${config.normalizeCategorical ? 'Yes' : 'No'}`);
  lines.push(`Auto Convert Types:    ${config.autoConvertTypes ? 'Yes' : 'No'}`);
  lines.push(`Create Date Parts:     ${config.createDateParts ? 'Yes' : 'No'}`);
  lines.push('');
  
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('CHANGES APPLIED');
  lines.push('───────────────────────────────────────────────────────────────');
  
  if (actions.length === 0) {
    lines.push('No changes were needed - dataset was already clean!');
  } else {
    actions.forEach((action, idx) => {
      lines.push(`${idx + 1}. ${action.description} (${action.count} items)`);
      if (action.details && action.details.length > 0) {
        action.details.forEach(detail => {
          lines.push(`   • ${detail}`);
        });
      }
    });
  }
  lines.push('');
  
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('COLUMN PROFILES');
  lines.push('───────────────────────────────────────────────────────────────');
  
  profile.columns.forEach(col => {
    lines.push(`▸ ${col.name}`);
    lines.push(`  Type: ${col.dataType} | Role: ${col.role}`);
    lines.push(`  Unique: ${col.uniqueCount} | Missing: ${col.nullCount}`);
    
    if (col.stats) {
      lines.push(`  Stats: min=${col.stats.min.toFixed(2)}, max=${col.stats.max.toFixed(2)}, mean=${col.stats.mean.toFixed(2)}, median=${col.stats.median.toFixed(2)}`);
    }
    
    if (col.issues.length > 0) {
      col.issues.forEach(issue => {
        lines.push(`  ⚠ ${issue.description}`);
      });
    }
    lines.push('');
  });
  
  if (profile.suggestedKpis.length > 0 || profile.suggestedFilters.length > 0) {
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('VISUALIZATION SUGGESTIONS');
    lines.push('───────────────────────────────────────────────────────────────');
    
    if (profile.suggestedKpis.length > 0) {
      lines.push('Suggested KPIs:');
      profile.suggestedKpis.forEach(kpi => lines.push(`  • ${kpi}`));
    }
    
    if (profile.suggestedFilters.length > 0) {
      lines.push('Suggested Filters:');
      profile.suggestedFilters.forEach(filter => lines.push(`  • ${filter}`));
    }
    
    if (profile.suggestedDrilldowns.length > 0) {
      lines.push('Suggested Drill-downs:');
      profile.suggestedDrilldowns.forEach(dd => lines.push(`  • ${dd}`));
    }
    lines.push('');
  }
  
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                      END OF REPORT                            ');
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

// Download helper
export function downloadFile(content: Blob | string, filename: string, mimeType?: string) {
  let blob: Blob;
  
  if (typeof content === 'string') {
    blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
  } else {
    blob = content;
  }
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

import { DataQualityReport } from '@/lib/csvCleaner';
import { 
  Rows, 
  Columns, 
  Copy, 
  AlertCircle, 
  Type,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface QualityReportProps {
  report: DataQualityReport;
  title?: string;
}

export function QualityReport({ report, title = "Data Quality Report" }: QualityReportProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card animate-fade-up stagger-1">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Rows className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{report.totalRows.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Rows</p>
          </div>
        </div>

        <div className="stat-card animate-fade-up stagger-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Columns className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{report.totalColumns}</p>
            <p className="text-xs text-muted-foreground">Columns</p>
          </div>
        </div>

        <div className="stat-card animate-fade-up stagger-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            report.duplicateRows > 0 ? 'bg-warning/10' : 'bg-success/10'
          }`}>
            <Copy className={`w-5 h-5 ${
              report.duplicateRows > 0 ? 'text-warning' : 'text-success'
            }`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{report.duplicateRows}</p>
            <p className="text-xs text-muted-foreground">Duplicates</p>
          </div>
        </div>

        <div className="stat-card animate-fade-up stagger-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            report.missingValues > 0 ? 'bg-warning/10' : 'bg-success/10'
          }`}>
            <AlertCircle className={`w-5 h-5 ${
              report.missingValues > 0 ? 'text-warning' : 'text-success'
            }`} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{report.missingValues}</p>
            <p className="text-xs text-muted-foreground">Missing Values</p>
          </div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center gap-2 pt-2">
        {report.isClean ? (
          <div className="status-badge clean">
            <CheckCircle2 className="w-4 h-4" />
            <span>Dataset is clean</span>
          </div>
        ) : (
          <div className="status-badge issues">
            <AlertTriangle className="w-4 h-4" />
            <span>{report.issues.length} issue(s) detected</span>
          </div>
        )}
      </div>

      {/* Issues List */}
      {report.issues.length > 0 && (
        <div className="glass-card rounded-xl p-4 space-y-2">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Detected Issues
          </h4>
          <ul className="space-y-1.5">
            {report.issues.map((issue, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-warning mt-2 flex-shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Text columns needing standardization */}
      {report.textColumnsToStandardize.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Type className="w-4 h-4" />
          <span>Text formatting issues in: {report.textColumnsToStandardize.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

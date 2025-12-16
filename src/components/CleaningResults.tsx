import * as XLSX from 'xlsx';
import { CleaningResult, dataToCSV } from '@/lib/csvCleaner';
import { QualityReport } from './QualityReport';
import { DataTable } from './DataTable';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2, Sparkles, ArrowLeft, FileSpreadsheet, FileText } from 'lucide-react';

interface CleaningResultsProps {
  result: CleaningResult;
  originalFileName: string;
  originalFormat: 'csv' | 'excel';
  onReset: () => void;
}

export function CleaningResults({ result, originalFileName, originalFormat, onReset }: CleaningResultsProps) {
  const handleDownloadCSV = () => {
    const csv = dataToCSV(result.data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const baseName = originalFileName.replace(/\.(csv|xlsx|xls)$/i, '');
    link.href = url;
    link.download = `${baseName}_cleaned.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(result.data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cleaned Data');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const baseName = originalFileName.replace(/\.(csv|xlsx|xls)$/i, '');
    link.href = url;
    link.download = `${baseName}_cleaned.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownload = () => {
    if (originalFormat === 'excel') {
      handleDownloadExcel();
    } else {
      handleDownloadCSV();
    }
  };

  const isAlreadyClean = result.report.isClean;

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Button
          variant="ghost"
          onClick={onReset}
          className="gap-2 hover:scale-105 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          Upload New File
        </Button>
        
        {!isAlreadyClean && (
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="gap-2 hover:scale-105 transition-transform">
              {originalFormat === 'excel' ? <FileSpreadsheet className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              Download {originalFormat === 'excel' ? 'Excel' : 'CSV'}
            </Button>
            <Button 
              variant="outline" 
              onClick={originalFormat === 'excel' ? handleDownloadCSV : handleDownloadExcel} 
              className="gap-2 hover:scale-105 transition-transform"
            >
              {originalFormat === 'excel' ? <FileText className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
              {originalFormat === 'excel' ? 'CSV' : 'Excel'}
            </Button>
          </div>
        )}
      </div>

      {/* Status Message */}
      {isAlreadyClean ? (
        <div className="glass-card rounded-2xl p-8 text-center animate-scale-in hover:shadow-lg transition-shadow">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Dataset is Already Clean
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            No changes applied. Your dataset has no duplicate rows, missing values, 
            or text formatting issues.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-8 animate-scale-in hover:shadow-lg transition-shadow">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground mb-2">
                Data Cleaning Complete
              </h2>
              <div className="space-y-2">
                {result.changesApplied.map((change, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm animate-fade-up" style={{ animationDelay: `${idx * 100}ms` }}>
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    <span className="text-foreground">{change}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Original Report */}
      <div className="space-y-4">
        <QualityReport 
          report={result.report} 
          title={isAlreadyClean ? "Dataset Analysis" : "Original Dataset"} 
        />
      </div>

      {/* Cleaned Report (if changes were made) */}
      {!isAlreadyClean && (
        <div className="space-y-4">
          <QualityReport 
            report={result.cleanedReport} 
            title="After Cleaning" 
          />
        </div>
      )}

      {/* Data Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            {isAlreadyClean ? 'Data Preview' : 'Cleaned Data Preview'}
          </h3>
          <span className="text-sm text-muted-foreground">
            First 50 rows
          </span>
        </div>
        <DataTable data={result.data} maxRows={50} />
      </div>

      {/* Download Button (bottom) */}
      {!isAlreadyClean && (
        <div className="flex justify-center gap-3 pt-4">
          <Button onClick={handleDownload} size="lg" className="gap-2 hover:scale-105 transition-transform">
            {originalFormat === 'excel' ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            Download {originalFormat === 'excel' ? 'Excel' : 'CSV'}
          </Button>
          <Button 
            variant="outline"
            size="lg" 
            onClick={originalFormat === 'excel' ? handleDownloadCSV : handleDownloadExcel} 
            className="gap-2 hover:scale-105 transition-transform"
          >
            {originalFormat === 'excel' ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
            Also as {originalFormat === 'excel' ? 'CSV' : 'Excel'}
          </Button>
        </div>
      )}
    </div>
  );
}

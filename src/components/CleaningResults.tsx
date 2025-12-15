import { CleaningResult, dataToCSV } from '@/lib/csvCleaner';
import { QualityReport } from './QualityReport';
import { DataTable } from './DataTable';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle2, Sparkles, ArrowLeft } from 'lucide-react';

interface CleaningResultsProps {
  result: CleaningResult;
  originalFileName: string;
  onReset: () => void;
}

export function CleaningResults({ result, originalFileName, onReset }: CleaningResultsProps) {
  const handleDownload = () => {
    const csv = dataToCSV(result.data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const baseName = originalFileName.replace(/\.csv$/i, '');
    link.href = url;
    link.download = `${baseName}_cleaned.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isAlreadyClean = result.report.isClean;

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={onReset}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Upload New File
        </Button>
        
        {!isAlreadyClean && (
          <Button onClick={handleDownload} className="gap-2">
            <Download className="w-4 h-4" />
            Download Cleaned CSV
          </Button>
        )}
      </div>

      {/* Status Message */}
      {isAlreadyClean ? (
        <div className="glass-card rounded-2xl p-8 text-center animate-scale-in">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
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
        <div className="glass-card rounded-2xl p-8 animate-scale-in">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground mb-2">
                Data Cleaning Complete
              </h2>
              <div className="space-y-2">
                {result.changesApplied.map((change, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
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
        <div className="flex justify-center pt-4">
          <Button onClick={handleDownload} size="lg" className="gap-2">
            <Download className="w-5 h-5" />
            Download Cleaned CSV
          </Button>
        </div>
      )}
    </div>
  );
}

import { EnhancedCleaningResult } from '@/lib/dataTypes';
import { dataToCSV, dataToExcel, dataToJSON, generateCleaningReport, downloadFile } from '@/lib/dataExporter';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator,
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText, FileJson, FileCode, ChevronDown } from 'lucide-react';

interface ExportPanelProps {
  result: EnhancedCleaningResult;
  originalFileName: string;
  originalFormat: 'csv' | 'excel';
}

export function ExportPanel({ result, originalFileName, originalFormat }: ExportPanelProps) {
  const baseName = originalFileName.replace(/\.(csv|xlsx|xls)$/i, '');
  const hasChanges = result.summary.totalChanges > 0;

  const handleDownloadCSV = () => {
    const csv = dataToCSV(result.data);
    downloadFile(csv, `${baseName}_cleaned.csv`, 'text/csv;charset=utf-8');
  };

  const handleDownloadExcel = () => {
    const blob = dataToExcel(result.data, 'Cleaned Data');
    downloadFile(blob, `${baseName}_cleaned.xlsx`);
  };

  const handleDownloadJSON = () => {
    const json = dataToJSON(result.data);
    downloadFile(json, `${baseName}_cleaned.json`, 'application/json');
  };

  const handleDownloadReport = () => {
    const report = generateCleaningReport(result, originalFileName);
    downloadFile(report, `${baseName}_cleaning_report.txt`, 'text/plain;charset=utf-8');
  };

  const handleDownloadPrimary = () => {
    if (originalFormat === 'excel') {
      handleDownloadExcel();
    } else {
      handleDownloadCSV();
    }
  };

  if (!hasChanges) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        No changes applied. Download the original file if needed.
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
      {/* Primary Download Button */}
      <Button 
        onClick={handleDownloadPrimary} 
        size="lg" 
        className="gap-2 min-w-[200px] hover:scale-105 transition-transform"
      >
        {originalFormat === 'excel' ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
        Download {originalFormat === 'excel' ? 'Excel' : 'CSV'}
      </Button>

      {/* More Formats Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="lg" className="gap-2 hover:scale-105 transition-transform">
            <Download className="w-4 h-4" />
            More Formats
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-56">
          <DropdownMenuItem onClick={handleDownloadCSV} className="gap-3 cursor-pointer">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="font-medium">CSV</p>
              <p className="text-xs text-muted-foreground">Comma-separated values</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadExcel} className="gap-3 cursor-pointer">
            <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="font-medium">Excel (.xlsx)</p>
              <p className="text-xs text-muted-foreground">Microsoft Excel format</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadJSON} className="gap-3 cursor-pointer">
            <FileJson className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="font-medium">JSON</p>
              <p className="text-xs text-muted-foreground">JavaScript Object Notation</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDownloadReport} className="gap-3 cursor-pointer">
            <FileCode className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="font-medium">Cleaning Report</p>
              <p className="text-xs text-muted-foreground">Detailed summary of changes</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

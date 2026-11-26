import { useMemo, useState } from 'react';
import { EnhancedCleaningResult } from '@/lib/dataTypes';
import { dataToCSV, dataToExcel, dataToJSON, generateCleaningReport, downloadFile } from '@/lib/dataExporter';
import { getIdentifierColumns, validateExportProfile, type ExportProfile } from '@/lib/exportProfiles';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [profile, setProfile] = useState<ExportProfile>('bi_ready');
  const [primaryKey, setPrimaryKey] = useState('');
  const keyCandidates = getIdentifierColumns(result.data);
  const columns = Object.keys(result.data[0] ?? {});
  const selectedKey = primaryKey || keyCandidates[0] || '';
  const validation = useMemo(
    () => validateExportProfile(result.data, profile, selectedKey || undefined),
    [result.data, profile, selectedKey],
  );
  const profileSuffix = profile;

  const handleDownloadCSV = () => {
    const csv = dataToCSV(validation.data);
    downloadFile(csv, `${baseName}_${profileSuffix}.csv`, 'text/csv;charset=utf-8');
  };

  const handleDownloadExcel = () => {
    const blob = dataToExcel(validation.data, 'Cleaned Data');
    downloadFile(blob, `${baseName}_${profileSuffix}.xlsx`);
  };

  const handleDownloadJSON = () => {
    const json = dataToJSON(validation.data);
    downloadFile(json, `${baseName}_${profileSuffix}.json`, 'application/json');
  };

  const handleDownloadReport = () => {
    const status = validation.ready ? 'READY' : 'NOT READY';
    const report = [
      generateCleaningReport(result, originalFileName),
      '',
      'EXPORT PROFILE CHECK',
      `Target: ${profile.replaceAll('_', ' ')}`,
      `Status: ${status}`,
      `Primary key: ${selectedKey || 'not selected'}`,
      `Categorical columns encoded: ${validation.encodedColumns}`,
      ...validation.errors.map((error) => `ERROR: ${error}`),
      ...validation.warnings.map((warning) => `WARNING: ${warning}`),
    ].join('\n');
    downloadFile(report, `${baseName}_cleaning_report.txt`, 'text/plain;charset=utf-8');
  };

  const handleDownloadPrimary = () => {
    if (originalFormat === 'excel') {
      handleDownloadExcel();
    } else {
      handleDownloadCSV();
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 text-left sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="export-profile">Export target</Label>
          <Select value={profile} onValueChange={(value) => setProfile(value as ExportProfile)}>
            <SelectTrigger id="export-profile">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bi_ready">BI Ready</SelectItem>
              <SelectItem value="ml_training_ready">ML Training Ready</SelectItem>
              <SelectItem value="data_engineering_ready">Data Engineering Ready</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(profile === 'bi_ready' || profile === 'data_engineering_ready') && (
          <div className="space-y-2">
            <Label htmlFor="export-primary-key">Key column</Label>
            <Select value={selectedKey} onValueChange={setPrimaryKey}>
              <SelectTrigger id="export-primary-key">
                <SelectValue placeholder="Choose a key column" />
              </SelectTrigger>
              <SelectContent>
                {columns.map((column) => <SelectItem key={column} value={column}>{column}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div role="status" className="space-y-2 rounded-md border p-4 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={validation.ready ? 'default' : 'destructive'}>
            {validation.ready ? 'Checks passed' : 'Review required'}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {profile === 'ml_training_ready'
              ? `${validation.encodedColumns} categorical columns encoded; ${validation.excludedIdentifiers.length} identifiers excluded.`
              : profile === 'data_engineering_ready'
                ? `Uniqueness checked for ${selectedKey || 'no selected key'}.`
                : `Key completeness checked for ${selectedKey || 'no selected key'}.`}
          </span>
        </div>
        {validation.errors.slice(0, 4).map((error) => (
          <p key={error} className="text-sm text-destructive">{error}</p>
        ))}
        {validation.errors.length > 4 && (
          <p className="text-xs text-muted-foreground">And {validation.errors.length - 4} more checks; the report includes the first 100.</p>
        )}
        {validation.warnings.map((warning) => (
          <p key={warning} className="text-sm text-muted-foreground">{warning}</p>
        ))}
      </div>

      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
      {/* Primary Download Button */}
      <Button 
        onClick={handleDownloadPrimary} 
        size="lg" 
        className="gap-2 min-w-[200px] hover:scale-105 transition-transform"
        disabled={!validation.ready}
      >
        {originalFormat === 'excel' ? <FileSpreadsheet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
        Download {originalFormat === 'excel' ? 'Excel' : 'CSV'}
      </Button>

      {/* More Formats Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="lg" className="gap-2 hover:scale-105 transition-transform" disabled={!validation.ready}>
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
    </div>
  );
}

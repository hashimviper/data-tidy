import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { FileUpload } from '@/components/FileUpload';
import { SheetSelector } from '@/components/SheetSelector';
import { StepIndicator } from '@/components/StepIndicator';
import { CleaningProgress } from '@/components/CleaningProgress';
import { CleaningConfigPanel } from '@/components/CleaningConfigPanel';
import { ColumnConfigPanel, ColumnOverride } from '@/components/ColumnConfigPanel';
import { CleaningSummaryPanel } from '@/components/CleaningSummaryPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { DataTable } from '@/components/DataTable';
import { BeforeAfterCharts } from '@/components/BeforeAfterCharts';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cleanDataAdvanced } from '@/lib/dataCleaner';
import { profileColumn } from '@/lib/dataAnalyzer';
import { CleaningConfig, DEFAULT_CLEANING_CONFIG, EnhancedCleaningResult, ColumnProfile } from '@/lib/dataTypes';
import { Sparkles, Database, Shield, Zap, ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ExcelWorkbook {
  workbook: XLSX.WorkBook;
  sheetNames: string[];
}

const STEPS = [
  { id: 1, label: 'Upload', description: 'Select your file' },
  { id: 2, label: 'Clean', description: 'Auto-process data' },
  { id: 3, label: 'Preview', description: 'Review changes' },
  { id: 4, label: 'Export', description: 'Download results' },
];

const Index = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<EnhancedCleaningResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileFormat, setFileFormat] = useState<'csv' | 'excel'>('csv');
  const [error, setError] = useState<string | null>(null);
  const [pendingWorkbook, setPendingWorkbook] = useState<ExcelWorkbook | null>(null);
  const [showSheetSelector, setShowSheetSelector] = useState(false);
  const [config, setConfig] = useState<CleaningConfig>(DEFAULT_CLEANING_CONFIG);
  const [rawData, setRawData] = useState<Record<string, unknown>[] | null>(null);
  const [columnOverrides, setColumnOverrides] = useState<Record<string, ColumnOverride>>({});
  const [columnProfiles, setColumnProfiles] = useState<ColumnProfile[]>([]);

  const readExcelWorkbook = (file: File): Promise<ExcelWorkbook> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          resolve({ workbook, sheetNames: workbook.SheetNames });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const processData = (data: Record<string, unknown>[]) => {
    setRawData(data);
    
    // Generate initial column profiles for the config panel
    const columns = Object.keys(data[0] || {});
    const profiles = columns.map(col => {
      const values = data.map(row => row[col]);
      return profileColumn(col, values, []);
    });
    setColumnProfiles(profiles);
    
    setCurrentStep(2);
    setIsProcessing(true);
  };

  const handleCleaningComplete = () => {
    if (rawData) {
      try {
        const cleaningResult = cleanDataAdvanced(rawData, config);
        setResult(cleaningResult);
        setCurrentStep(3);
      } catch (err) {
        setError('Error processing data. Please check your file format.');
      }
    }
    setIsProcessing(false);
  };

  const processSheet = (workbook: XLSX.WorkBook, sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

    if (jsonData.length === 0) {
      setError('The selected sheet appears to be empty.');
      setIsLoading(false);
      return;
    }

    processData(jsonData);
    setIsLoading(false);
  };

  const handleSheetSelect = (sheetName: string) => {
    setShowSheetSelector(false);
    if (pendingWorkbook) {
      setIsLoading(true);
      processSheet(pendingWorkbook.workbook, sheetName);
      setPendingWorkbook(null);
    }
  };

  const handleSheetCancel = () => {
    setShowSheetSelector(false);
    setPendingWorkbook(null);
    setFileName('');
    setFileFormat('csv');
  };

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    setFileFormat(isExcel ? 'excel' : 'csv');

    try {
      if (isExcel) {
        const excelData = await readExcelWorkbook(file);

        if (excelData.sheetNames.length > 1) {
          setIsLoading(false);
          setPendingWorkbook(excelData);
          setShowSheetSelector(true);
        } else {
          processSheet(excelData.workbook, excelData.sheetNames[0]);
        }
      } else {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              setError('Error parsing CSV file. Please ensure it is properly formatted.');
              setIsLoading(false);
              return;
            }

            const data = results.data as Record<string, unknown>[];
            
            if (data.length === 0) {
              setError('The CSV file appears to be empty.');
              setIsLoading(false);
              return;
            }

            processData(data);
            setIsLoading(false);
          },
          error: (err) => {
            setError(`Error reading file: ${err.message}`);
            setIsLoading(false);
          },
        });
      }
    } catch (err) {
      setError('An unexpected error occurred while processing the file.');
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setRawData(null);
    setFileName('');
    setFileFormat('csv');
    setError(null);
    setPendingWorkbook(null);
    setCurrentStep(1);
    setConfig(DEFAULT_CLEANING_CONFIG);
    setColumnOverrides({});
    setColumnProfiles([]);
  };

  // Initialize theme on mount
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.add(theme);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Data Prep Studio</h1>
                <p className="text-xs text-muted-foreground">Analysis-ready data preparation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              {currentStep > 1 && (
                <Button variant="ghost" onClick={handleReset} className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Start Over
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        {/* Step Indicator */}
        <div className="max-w-3xl mx-auto mb-8">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* Step 1: Upload */}
        {currentStep === 1 && (
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-4 animate-fade-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                Professional Data Preparation
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Prepare Your Data for{' '}
                <span className="gradient-text">Analysis</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Upload your dataset and let our intelligent engine clean, standardize, 
                and optimize it for visualization tools like Power BI and Tableau.
              </p>
            </div>

            <div className="animate-fade-up stagger-2">
              <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
            </div>

            {error && (
              <div className="glass-card rounded-xl p-4 border-destructive/50 bg-destructive/5 animate-scale-in">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            <div className="animate-fade-up stagger-3 space-y-4">
              <CleaningConfigPanel config={config} onChange={setConfig} />
              {columnProfiles.length > 0 && (
                <ColumnConfigPanel 
                  columns={columnProfiles} 
                  overrides={columnOverrides}
                  onChange={setColumnOverrides}
                />
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-4 pt-4">
              <div className="glass-card rounded-xl p-5 animate-fade-up stagger-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Smart Detection</h3>
                <p className="text-sm text-muted-foreground">
                  Auto-detects data types, outliers, and inconsistencies.
                </p>
              </div>

              <div className="glass-card rounded-xl p-5 animate-fade-up stagger-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Safe Cleaning</h3>
                <p className="text-sm text-muted-foreground">
                  Handles missing values with intelligent imputation methods.
                </p>
              </div>

              <div className="glass-card rounded-xl p-5 animate-fade-up stagger-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">BI-Ready Output</h3>
                <p className="text-sm text-muted-foreground">
                  Creates derived columns and suggests KPIs for dashboards.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {currentStep === 2 && (
          <div className="max-w-2xl mx-auto">
            <CleaningProgress isProcessing={isProcessing} onComplete={handleCleaningComplete} />
          </div>
        )}

        {/* Step 3 & 4: Results */}
        {currentStep >= 3 && result && (
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-up">
            <Tabs defaultValue="summary" className="w-full" onValueChange={(v) => setCurrentStep(v === 'export' ? 4 : 3)}>
              <TabsList className="grid w-full max-w-lg mx-auto grid-cols-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="charts">Charts</TabsTrigger>
                <TabsTrigger value="preview">Data Preview</TabsTrigger>
                <TabsTrigger value="export">Export</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-6">
                <CleaningSummaryPanel 
                  summary={result.summary} 
                  actions={result.actions} 
                  profile={result.profile} 
                />
              </TabsContent>

              <TabsContent value="charts" className="mt-6">
                <BeforeAfterCharts result={result} />
              </TabsContent>

              <TabsContent value="preview" className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Cleaned Data Preview</h3>
                  <span className="text-sm text-muted-foreground">
                    {result.data.length.toLocaleString()} rows × {Object.keys(result.data[0] || {}).length} columns
                  </span>
                </div>
                <DataTable data={result.data} maxRows={100} />
              </TabsContent>

              <TabsContent value="export" className="mt-6">
                <div className="glass-card rounded-2xl p-8 text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">Ready for Download</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Your cleaned dataset is ready. Download in multiple formats or generate a detailed cleaning report.
                    </p>
                  </div>
                  <ExportPanel result={result} originalFileName={fileName} originalFormat={fileFormat} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      <SheetSelector
        open={showSheetSelector}
        sheetNames={pendingWorkbook?.sheetNames || []}
        onSelect={handleSheetSelect}
        onCancel={handleSheetCancel}
      />

      <footer className="border-t border-border/50 mt-auto">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Data Prep Studio — Professional data preparation for analysis
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

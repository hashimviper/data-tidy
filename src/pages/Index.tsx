import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { FileUpload } from '@/components/FileUpload';
import { SheetSelector } from '@/components/SheetSelector';
import { CleaningProgress } from '@/components/CleaningProgress';
import { CleaningConfigPanel } from '@/components/CleaningConfigPanel';
import { ColumnConfigPanel, ColumnOverride } from '@/components/ColumnConfigPanel';
import { CleaningSummaryPanel } from '@/components/CleaningSummaryPanel';
import { SchemaMappingPanel } from '@/components/SchemaMappingPanel';
import { ExportPanel } from '@/components/ExportPanel';
import { DataTable } from '@/components/DataTable';
import { BeforeAfterCharts } from '@/components/BeforeAfterCharts';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardHeader } from '@/components/DashboardHeader';
import { QuickStats } from '@/components/QuickStats';
import { InteractiveUpload } from '@/components/InteractiveUpload';
import { cleanDataAdvanced } from '@/lib/dataCleaner';
import { profileColumn } from '@/lib/dataAnalyzer';
import { autoTransform, SchemaValidationResult, DataQualitySummary } from '@/lib/schemaEngine';
import { CleaningConfig, DEFAULT_CLEANING_CONFIG, EnhancedCleaningResult, ColumnProfile } from '@/lib/dataTypes';
import { Sparkles, Download, BarChart3, Table, FileText, Settings2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface ExcelWorkbook {
  workbook: XLSX.WorkBook;
  sheetNames: string[];
}

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  const [schemaValidation, setSchemaValidation] = useState<SchemaValidationResult | null>(null);
  const [qualitySummary, setQualitySummary] = useState<DataQualitySummary | null>(null);

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
    
    const columns = Object.keys(data[0] || {});
    const profiles = columns.map(col => {
      const values = data.map(row => row[col]);
      return profileColumn(col, values, []);
    });
    setColumnProfiles(profiles);
    
    setCurrentStep(2);
  };

  const startCleaning = () => {
    if (rawData) {
      setCurrentStep(3);
      setIsProcessing(true);
    }
  };

  const handleCleaningComplete = () => {
    if (rawData) {
      try {
        // Run schema engine (auto-infers schema, validates, transforms with idempotency)
        const { validationResult, transformationResult } = autoTransform(rawData);
        setSchemaValidation(validationResult);
        
        if (transformationResult) {
          setQualitySummary(transformationResult.qualitySummary);
        }

        // Run the full cleaning pipeline on successfully transformed data
        const dataToClean = transformationResult ? transformationResult.data : rawData;
        const cleaningResult = cleanDataAdvanced(dataToClean, config);
        setResult(cleaningResult);
        setCurrentStep(4);
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
    setActiveTab('summary');
    setSchemaValidation(null);
    setQualitySummary(null);
  };

  const handleNavigate = (step: number) => {
    if (step === 1) {
      handleReset();
    } else if (step === 2 && rawData) {
      setCurrentStep(2);
    } else if (step === 3 && rawData) {
      startCleaning();
    } else if (step === 4 && result) {
      setCurrentStep(4);
    } else if (step === 5 && result) {
      setCurrentStep(5);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.classList.add(theme);
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <DashboardSidebar
        currentStep={currentStep}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onNavigate={handleNavigate}
        hasData={!!rawData}
        hasResult={!!result}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <DashboardHeader
          currentStep={currentStep}
          fileName={fileName}
          onReset={handleReset}
          hasData={!!rawData}
        />

        <main className="flex-1 p-6 overflow-y-auto">
          {/* Step 1: Upload */}
          {currentStep === 1 && (
            <div className="max-w-3xl mx-auto">
              <InteractiveUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
              
              {error && (
                <div className="glass-card rounded-xl p-4 border-destructive/50 bg-destructive/5 animate-scale-in mt-6">
                  <p className="text-sm text-destructive text-center">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure */}
          {currentStep === 2 && rawData && (
            <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Configure Cleaning Options</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Customize how your data will be processed
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {rawData.length.toLocaleString()} rows • {columnProfiles.length} columns
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <CleaningConfigPanel config={config} onChange={setConfig} />
                  
                  {columnProfiles.length > 0 && (
                    <ColumnConfigPanel 
                      columns={columnProfiles} 
                      overrides={columnOverrides}
                      onChange={setColumnOverrides}
                    />
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-border flex justify-end">
                  <Button 
                    onClick={startCleaning}
                    size="lg"
                    className="gap-2 px-8 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    Start Cleaning
                  </Button>
                </div>
              </div>

              {/* Data Preview */}
              <div className="glass-card rounded-2xl p-6">
                <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Table className="w-4 h-4 text-primary" />
                  Data Preview (First 10 rows)
                </h4>
                <DataTable data={rawData} maxRows={10} />
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {currentStep === 3 && (
            <div className="max-w-2xl mx-auto">
              <CleaningProgress isProcessing={isProcessing} onComplete={handleCleaningComplete} />
            </div>
          )}

          {/* Step 4: Results */}
          {currentStep === 4 && result && (
            <div className="space-y-6 animate-fade-up">
              {/* Quick Stats */}
              <QuickStats result={result} />

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="inline-flex h-11 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                  <TabsTrigger value="summary" className="gap-2">
                    <FileText className="w-4 h-4" />
                    Summary
                  </TabsTrigger>
                  {schemaValidation && (
                    <TabsTrigger value="schema" className="gap-2">
                      <Layers className="w-4 h-4" />
                      Schema
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="charts" className="gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Charts
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <Table className="w-4 h-4" />
                    Data Preview
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="mt-6">
                  <CleaningSummaryPanel 
                    summary={result.summary} 
                    actions={result.actions} 
                    profile={result.profile}
                    columnQualityMetrics={result.columnQualityMetrics}
                    protectedFields={result.protectedFields}
                    flaggedIds={result.flaggedIds}
                    derivedFromImputed={result.derivedFromImputed}
                  />
                </TabsContent>

                {schemaValidation && (
                  <TabsContent value="schema" className="mt-6">
                    <SchemaMappingPanel 
                      validation={schemaValidation} 
                      qualitySummary={qualitySummary} 
                    />
                  </TabsContent>
                )}

                <TabsContent value="charts" className="mt-6">
                  <BeforeAfterCharts result={result} />
                </TabsContent>

                <TabsContent value="preview" className="mt-6">
                  <div className="glass-card rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-foreground">Cleaned Data Preview</h3>
                      <span className="text-sm text-muted-foreground">
                        {result.data.length.toLocaleString()} rows × {Object.keys(result.data[0] || {}).length} columns
                      </span>
                    </div>
                    <DataTable data={result.data} maxRows={100} />
                  </div>
                </TabsContent>
              </Tabs>

              {/* Export CTA */}
              <div className="glass-card rounded-2xl p-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Download className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Ready for Download</h3>
                      <p className="text-sm text-muted-foreground">Export your cleaned dataset in multiple formats</p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setCurrentStep(5)}
                    className="gap-2 shadow-lg shadow-primary/20"
                  >
                    <Download className="w-4 h-4" />
                    Go to Export
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Export */}
          {currentStep === 5 && result && (
            <div className="max-w-3xl mx-auto space-y-6 animate-fade-up">
              <div className="glass-card rounded-2xl p-8 text-center space-y-6">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto border border-primary/20">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Your Data is Ready!</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Download your cleaned and optimized dataset in multiple formats, or generate a detailed cleaning report.
                  </p>
                </div>
                <ExportPanel result={result} originalFileName={fileName} originalFormat={fileFormat} />
              </div>

              {/* Back to Results */}
              <Button 
                variant="ghost" 
                onClick={() => setCurrentStep(4)}
                className="mx-auto flex gap-2"
              >
                ← Back to Results
              </Button>
            </div>
          )}
        </main>
      </div>

      <SheetSelector
        open={showSheetSelector}
        sheetNames={pendingWorkbook?.sheetNames || []}
        onSelect={handleSheetSelect}
        onCancel={handleSheetCancel}
      />
    </div>
  );
};

export default Index;

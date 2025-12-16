import { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { FileUpload } from '@/components/FileUpload';
import { CleaningResults } from '@/components/CleaningResults';
import { CleaningResult, cleanData } from '@/lib/csvCleaner';
import { Sparkles, Database, Shield, Zap } from 'lucide-react';

const Index = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CleaningResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileFormat, setFileFormat] = useState<'csv' | 'excel'>('csv');
  const [error, setError] = useState<string | null>(null);

  const parseExcelFile = (file: File): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsBinaryString(file);
    });
  };

  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setFileName(file.name);

    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    setFileFormat(isExcel ? 'excel' : 'csv');

    try {
      if (isExcel) {
        const data = await parseExcelFile(file);
        
        if (data.length === 0) {
          setError('The Excel file appears to be empty.');
          setIsLoading(false);
          return;
        }

        const cleaningResult = cleanData(data);
        setResult(cleaningResult);
        setIsLoading(false);
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

            const cleaningResult = cleanData(data);
            setResult(cleaningResult);
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
    setFileName('');
    setFileFormat('csv');
    setError(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">CSV Data Cleaner</h1>
              <p className="text-xs text-muted-foreground">Intelligent data quality analysis</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        {!result ? (
          <div className="max-w-2xl mx-auto space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-4 animate-fade-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                Smart Data Cleaning
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Clean Your Data{' '}
                <span className="gradient-text">Intelligently</span>
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Upload your CSV or Excel file and our smart analyzer will detect issues and clean your data 
                without removing valid outliers or meaningful values.
              </p>
            </div>

            {/* Upload Zone */}
            <div className="animate-fade-up stagger-2">
              <FileUpload onFileSelect={handleFileSelect} isLoading={isLoading} />
            </div>

            {/* Error Message */}
            {error && (
              <div className="glass-card rounded-xl p-4 border-destructive/50 bg-destructive/5 animate-scale-in">
                <p className="text-sm text-destructive text-center">{error}</p>
              </div>
            )}

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-4 pt-4">
              <div className="glass-card rounded-xl p-5 animate-fade-up stagger-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Smart Detection</h3>
                <p className="text-sm text-muted-foreground">
                  Automatically detects duplicates, missing values, and formatting issues.
                </p>
              </div>

              <div className="glass-card rounded-xl p-5 animate-fade-up stagger-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Safe Cleaning</h3>
                <p className="text-sm text-muted-foreground">
                  Preserves valid outliers and meaningful negative values in your data.
                </p>
              </div>

              <div className="glass-card rounded-xl p-5 animate-fade-up stagger-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Skip If Clean</h3>
                <p className="text-sm text-muted-foreground">
                  Won't modify data that's already clean. Only applies necessary fixes.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <CleaningResults 
              result={result} 
              originalFileName={fileName}
              originalFormat={fileFormat}
              onReset={handleReset} 
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            CSV Data Cleaner — Built for portfolio demonstrations
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;

import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Bell, Sparkles, FileSpreadsheet } from 'lucide-react';

interface DashboardHeaderProps {
  currentStep: number;
  fileName?: string;
  onReset: () => void;
  hasData: boolean;
}

const stepTitles: Record<number, { title: string; subtitle: string }> = {
  1: { title: 'Upload Dataset', subtitle: 'Import your CSV or Excel file' },
  2: { title: 'Configure Cleaning', subtitle: 'Set your preferences' },
  3: { title: 'Processing', subtitle: 'Cleaning your data' },
  4: { title: 'Analysis Results', subtitle: 'Review your cleaned data' },
  5: { title: 'Export', subtitle: 'Download your results' },
};

export function DashboardHeader({ currentStep, fileName, onReset, hasData }: DashboardHeaderProps) {
  const { title, subtitle } = stepTitles[currentStep] || stepTitles[1];

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          {hasData && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onReset}
              className="hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">{title}</h2>
              {fileName && (
                <Badge variant="secondary" className="gap-1.5 font-normal">
                  <FileSpreadsheet className="w-3 h-3" />
                  {fileName}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasData && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
              <Sparkles className="w-4 h-4" />
              <span className="font-medium">AI-Powered</span>
            </div>
          )}
          
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </Button>
          
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

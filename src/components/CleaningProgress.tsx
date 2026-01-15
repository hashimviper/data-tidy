import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Database, Sparkles, Search, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface CleaningProgressProps {
  isProcessing: boolean;
  onComplete?: () => void;
}

interface ProgressStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  duration: number;
}

const CLEANING_STEPS: ProgressStep[] = [
  { id: 'load', label: 'Loading dataset', icon: <Database className="w-4 h-4" />, duration: 300 },
  { id: 'analyze', label: 'Analyzing data quality', icon: <Search className="w-4 h-4" />, duration: 500 },
  { id: 'detect', label: 'Detecting issues', icon: <AlertTriangle className="w-4 h-4" />, duration: 400 },
  { id: 'clean', label: 'Cleaning data', icon: <Sparkles className="w-4 h-4" />, duration: 600 },
  { id: 'optimize', label: 'Optimizing for visualization', icon: <Zap className="w-4 h-4" />, duration: 400 },
  { id: 'complete', label: 'Finalizing', icon: <CheckCircle2 className="w-4 h-4" />, duration: 200 },
];

export function CleaningProgress({ isProcessing, onComplete }: CleaningProgressProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setCurrentStepIndex(0);
      setProgress(0);
      setStepProgress(0);
      return;
    }

    let mounted = true;
    const totalDuration = CLEANING_STEPS.reduce((sum, s) => sum + s.duration, 0);
    let elapsed = 0;
    let stepIdx = 0;
    let stepElapsed = 0;

    const interval = setInterval(() => {
      if (!mounted) return;

      elapsed += 50;
      stepElapsed += 50;

      const overallProgress = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(overallProgress);

      const currentStep = CLEANING_STEPS[stepIdx];
      if (currentStep) {
        const stepProg = Math.min((stepElapsed / currentStep.duration) * 100, 100);
        setStepProgress(stepProg);

        if (stepElapsed >= currentStep.duration && stepIdx < CLEANING_STEPS.length - 1) {
          stepIdx++;
          stepElapsed = 0;
          setCurrentStepIndex(stepIdx);
        }
      }

      if (elapsed >= totalDuration) {
        clearInterval(interval);
        setCurrentStepIndex(CLEANING_STEPS.length - 1);
        setProgress(100);
        setStepProgress(100);
        onComplete?.();
      }
    }, 50);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isProcessing, onComplete]);

  if (!isProcessing) return null;

  const currentStep = CLEANING_STEPS[currentStepIndex];

  return (
    <div className="glass-card rounded-2xl p-8 animate-scale-in">
      <div className="flex flex-col items-center gap-6">
        {/* Animated Icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center">
            {currentStep?.icon}
          </div>
        </div>

        {/* Current Step */}
        <div className="text-center">
          <h3 className="text-xl font-semibold text-foreground mb-1">
            {currentStep?.label || 'Processing...'}
          </h3>
          <p className="text-sm text-muted-foreground">
            Please wait while we prepare your data
          </p>
        </div>

        {/* Overall Progress */}
        <div className="w-full max-w-md space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Step {currentStepIndex + 1} of {CLEANING_STEPS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Step List */}
        <div className="w-full max-w-md grid grid-cols-2 md:grid-cols-3 gap-2">
          {CLEANING_STEPS.map((step, idx) => {
            const isComplete = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isPending = idx > currentStepIndex;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all duration-300",
                  isComplete && "bg-success/10 text-success",
                  isCurrent && "bg-primary/10 text-primary font-medium",
                  isPending && "bg-muted/30 text-muted-foreground"
                )}
              >
                <div className={cn(
                  "w-4 h-4 flex items-center justify-center",
                  isCurrent && "animate-pulse"
                )}>
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span className="truncate">{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

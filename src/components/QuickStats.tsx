import { EnhancedCleaningResult } from '@/lib/dataTypes';
import { 
  Rows, Columns, AlertCircle, CheckCircle2, 
  TrendingUp, Gauge, Sparkles, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickStatsProps {
  result: EnhancedCleaningResult;
}

export function QuickStats({ result }: QuickStatsProps) {
  const { summary, profile } = result;
  const qualityScore = profile.dataDescription.dataQualityScore;
  
  const stats = [
    {
      label: 'Total Rows',
      value: summary.rowsAfter.toLocaleString(),
      change: summary.rowsBefore - summary.rowsAfter,
      changeType: 'removed' as const,
      icon: Rows,
      color: 'primary',
    },
    {
      label: 'Total Columns',
      value: summary.columnsAfter.toString(),
      change: summary.columnsAfter - summary.columnsBefore,
      changeType: 'added' as const,
      icon: Columns,
      color: 'success',
    },
    {
      label: 'Issues Fixed',
      value: summary.totalChanges.toLocaleString(),
      icon: CheckCircle2,
      color: 'warning',
    },
    {
      label: 'Quality Score',
      value: `${qualityScore}%`,
      icon: Gauge,
      color: qualityScore >= 80 ? 'success' : qualityScore >= 60 ? 'warning' : 'destructive',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <div 
          key={stat.label}
          className="group glass-card rounded-xl p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1 cursor-default animate-fade-up"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110",
              stat.color === 'primary' && "bg-primary/10",
              stat.color === 'success' && "bg-success/10",
              stat.color === 'warning' && "bg-warning/10",
              stat.color === 'destructive' && "bg-destructive/10",
            )}>
              <stat.icon className={cn(
                "w-5 h-5",
                stat.color === 'primary' && "text-primary",
                stat.color === 'success' && "text-success",
                stat.color === 'warning' && "text-warning",
                stat.color === 'destructive' && "text-destructive",
              )} />
            </div>
            
            {stat.change !== undefined && stat.change !== 0 && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                stat.changeType === 'removed' ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"
              )}>
                {stat.changeType === 'removed' ? (
                  <ArrowDownRight className="w-3 h-3" />
                ) : (
                  <ArrowUpRight className="w-3 h-3" />
                )}
                {Math.abs(stat.change)}
              </div>
            )}
          </div>
          
          <p className="text-2xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
            {stat.value}
          </p>
          <p className="text-sm text-muted-foreground">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

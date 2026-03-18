import { DatasetAnalysis, ColumnAnalysis } from '@/lib/aiAnalyzer';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Database,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AIInsightsPanelProps {
  analysis: DatasetAnalysis;
}

function severityColor(severity: string) {
  switch (severity) {
    case 'high': return 'text-destructive';
    case 'medium': return 'text-warning';
    case 'low': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
}

function severityBg(severity: string) {
  switch (severity) {
    case 'high': return 'bg-destructive/10';
    case 'medium': return 'bg-warning/10';
    case 'low': return 'bg-muted';
    default: return 'bg-muted';
  }
}

function qualityColor(score: number) {
  if (score >= 80) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-destructive';
}

function qualityBg(score: number) {
  if (score >= 80) return 'bg-success';
  if (score >= 50) return 'bg-warning';
  return 'bg-destructive';
}

function ColumnCard({ column }: { column: ColumnAnalysis }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', qualityBg(column.quality_score))} />
          <div className="min-w-0">
            <span className="font-mono text-sm font-medium text-foreground">{column.name}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className="text-xs capitalize">
                {column.detected_type}
              </Badge>
              {column.missing_percent > 0 && (
                <span className="text-xs text-muted-foreground">
                  {column.missing_percent}% missing
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={cn('text-sm font-bold', qualityColor(column.quality_score))}>
            {column.quality_score}
          </span>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50">
          {/* Issues */}
          {column.issues.length > 0 && (
            <div className="space-y-1.5 pt-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Issues</span>
              {column.issues.map((issue, idx) => (
                <div key={idx} className={cn('flex items-start gap-2 px-3 py-2 rounded-lg text-sm', severityBg(issue.severity))}>
                  <AlertCircle className={cn('w-3.5 h-3.5 mt-0.5 flex-shrink-0', severityColor(issue.severity))} />
                  <span className="text-foreground">{issue.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* Sample Values */}
          {column.sample_values.length > 0 && (
            <div className="pt-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sample Values</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {column.sample_values.map((val, idx) => (
                  <code key={idx} className="px-2 py-0.5 bg-muted rounded text-xs font-mono text-foreground">
                    {val.length > 30 ? val.slice(0, 30) + '...' : val}
                  </code>
                ))}
              </div>
            </div>
          )}

          {column.issues.length === 0 && (
            <div className="flex items-center gap-2 pt-3 text-sm text-success">
              <CheckCircle2 className="w-4 h-4" />
              No issues detected
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AIInsightsPanel({ analysis }: AIInsightsPanelProps) {
  const highIssues = analysis.columns.flatMap(c => c.issues.filter(i => i.severity === 'high'));
  const mediumIssues = analysis.columns.flatMap(c => c.issues.filter(i => i.severity === 'medium'));

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">AI Dataset Analysis</h3>
            <p className="text-sm text-muted-foreground">{analysis.total_rows.toLocaleString()} rows • {analysis.columns.length} columns</p>
          </div>
        </div>

        {/* Quality Score */}
        <div className="flex items-center gap-6 mb-4">
          <div className="text-center">
            <div className={cn('text-4xl font-bold', qualityColor(analysis.overall_quality_score))}>
              {analysis.overall_quality_score}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Quality Score</div>
          </div>
          <div className="flex-1 space-y-2">
            <Progress value={analysis.overall_quality_score} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{analysis.total_issues} issue(s) found</span>
              <span>
                {analysis.overall_quality_score >= 80 ? 'Good quality' :
                 analysis.overall_quality_score >= 50 ? 'Needs cleaning' : 'Poor quality'}
              </span>
            </div>
          </div>
        </div>

        {/* Issue Summary Badges */}
        <div className="flex flex-wrap gap-2">
          {highIssues.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              {highIssues.length} critical
            </div>
          )}
          {mediumIssues.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warning/10 text-warning text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              {mediumIssues.length} warnings
            </div>
          )}
          {analysis.total_issues === 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              No issues — dataset looks clean!
            </div>
          )}
        </div>

        {/* AI Summary */}
        <div className="mt-4 p-3 rounded-xl bg-muted/50 border border-border/50">
          <div className="flex items-start gap-2">
            <Database className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground leading-relaxed">{analysis.summary}</p>
          </div>
        </div>
      </div>

      {/* Column Details */}
      <div className="glass-card rounded-2xl p-6">
        <h4 className="font-semibold text-foreground mb-4">Column Analysis</h4>
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2">
            {analysis.columns.map((col) => (
              <ColumnCard key={col.name} column={col} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

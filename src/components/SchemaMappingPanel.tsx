import { SchemaValidationResult, MappingRequirement, DataQualitySummary } from '@/lib/schemaEngine';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, AlertTriangle, XCircle, ArrowRight,
  Gauge, FileWarning, Copy, Layers, BarChart3, Hash
} from 'lucide-react';

interface SchemaMappingPanelProps {
  validation: SchemaValidationResult;
  qualitySummary?: DataQualitySummary | null;
}

function StatusIcon({ status }: { status: MappingRequirement['status'] }) {
  switch (status) {
    case 'exact':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'fuzzy':
      return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    case 'unmatched':
      return <XCircle className="w-4 h-4 text-destructive" />;
  }
}

function ConfidenceBadge({ score }: { score: number }) {
  const variant = score >= 80 ? 'default' : score >= 50 ? 'secondary' : 'destructive';
  return (
    <Badge variant={variant} className="font-mono text-xs w-14 justify-center">
      {score}%
    </Badge>
  );
}

export function SchemaMappingPanel({ validation, qualitySummary }: SchemaMappingPanelProps) {
  const exactCount = validation.mappings.filter(m => m.status === 'exact').length;
  const fuzzyCount = validation.mappings.filter(m => m.status === 'fuzzy').length;
  const unmatchedCount = validation.mappings.filter(m => m.status === 'unmatched').length;

  return (
    <div className="space-y-6">
      {/* Schema Validation Header */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Schema Validation
          </h4>
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Overall Confidence:</span>
            <ConfidenceBadge score={validation.overallConfidence} />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <div>
              <p className="text-lg font-bold text-foreground">{exactCount}</p>
              <p className="text-xs text-muted-foreground">Exact Matches</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-lg font-bold text-foreground">{fuzzyCount}</p>
              <p className="text-xs text-muted-foreground">Fuzzy Matches</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10">
            <XCircle className="w-4 h-4 text-destructive" />
            <div>
              <p className="text-lg font-bold text-foreground">{unmatchedCount}</p>
              <p className="text-xs text-muted-foreground">Unmatched</p>
            </div>
          </div>
        </div>

        {/* Mapping Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr,auto,1fr,auto,auto] gap-2 px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
            <span>Source Column</span>
            <span></span>
            <span>Target Column</span>
            <span>Status</span>
            <span>Score</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-border">
            {validation.mappings.map((m, idx) => (
              <div key={idx} className="grid grid-cols-[1fr,auto,1fr,auto,auto] gap-2 px-4 py-2.5 items-center text-sm hover:bg-muted/20 transition-colors">
                <span className="font-mono text-foreground truncate">{m.sourceColumn}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <span className={`font-mono truncate ${m.suggestedTarget ? 'text-foreground' : 'text-destructive italic'}`}>
                  {m.suggestedTarget || '— no match —'}
                </span>
                <StatusIcon status={m.status} />
                <ConfidenceBadge score={m.confidence} />
              </div>
            ))}
          </div>
        </div>

        {/* Unmatched warnings */}
        {validation.unmappedTarget.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <h5 className="text-sm font-medium text-destructive flex items-center gap-2 mb-2">
              <FileWarning className="w-4 h-4" />
              Missing Target Columns
            </h5>
            <div className="flex flex-wrap gap-1">
              {validation.unmappedTarget.map((col, i) => (
                <Badge key={i} variant="destructive" className="text-xs">{col}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Data Quality Summary */}
      {qualitySummary && (
        <div className="glass-card rounded-xl p-5">
          <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Data Quality Summary
          </h4>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <p className="text-2xl font-bold text-foreground">{qualitySummary.rowsProcessed}</p>
              <p className="text-xs text-muted-foreground">Rows Processed</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/10">
              <p className="text-2xl font-bold text-emerald-600">{qualitySummary.rowsSucceeded}</p>
              <p className="text-xs text-muted-foreground">Rows Succeeded</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-destructive/10">
              <p className="text-2xl font-bold text-destructive">{qualitySummary.rowsFailed}</p>
              <p className="text-xs text-muted-foreground">Rows Failed</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold text-foreground">{qualitySummary.duplicatesSkipped}</p>
              <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
            </div>
          </div>

          {/* Mapping Confidence */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-muted-foreground">Mapping Confidence:</span>
            <Progress value={qualitySummary.mappingConfidenceScore} className="flex-1 h-2" />
            <Badge variant={qualitySummary.mappingConfidenceScore >= 80 ? 'default' : 'secondary'} className="font-mono text-xs">
              {qualitySummary.mappingConfidenceScore}%
            </Badge>
          </div>

          {/* Failure Reasons */}
          {Object.keys(qualitySummary.failureReasons).length > 0 && (
            <div className="border-t border-border pt-4">
              <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Failure Reasons
              </h5>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {Object.entries(qualitySummary.failureReasons).map(([reason, count], idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm px-3 py-1.5 rounded bg-muted/20">
                    <span className="text-muted-foreground truncate mr-2">{reason}</span>
                    <Badge variant="outline" className="text-xs font-mono">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-Column Stats */}
          {Object.keys(qualitySummary.columnStats).length > 0 && (
            <div className="border-t border-border pt-4 mt-4">
              <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Hash className="w-4 h-4 text-primary" />
                Per-Column Validation
              </h5>
              <div className="grid gap-1.5 max-h-[200px] overflow-y-auto">
                {Object.entries(qualitySummary.columnStats).map(([col, stats], idx) => {
                  const total = stats.valid + stats.invalid + stats.missing;
                  const pct = total > 0 ? Math.round((stats.valid / total) * 100) : 100;
                  return (
                    <div key={idx} className="flex items-center gap-3 px-3 py-1.5 rounded bg-muted/20">
                      <span className="text-sm font-mono truncate flex-1">{col}</span>
                      <span className="text-xs text-emerald-500">{stats.valid}✓</span>
                      {stats.invalid > 0 && <span className="text-xs text-destructive">{stats.invalid}✗</span>}
                      {stats.missing > 0 && <span className="text-xs text-muted-foreground">{stats.missing}∅</span>}
                      <Progress value={pct} className="w-16 h-1.5" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

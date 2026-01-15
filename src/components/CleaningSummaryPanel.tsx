import { CleaningSummary, CleaningAction, DatasetProfile } from '@/lib/dataTypes';
import { 
  Rows, Columns, Copy, AlertCircle, Type, Zap, Calendar, 
  CheckCircle2, TrendingUp, Filter, Layers, BarChart3,
  Database, Sparkles, ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CleaningSummaryPanelProps {
  summary: CleaningSummary;
  actions: CleaningAction[];
  profile: DatasetProfile;
}

export function CleaningSummaryPanel({ summary, actions, profile }: CleaningSummaryPanelProps) {
  const hasChanges = summary.totalChanges > 0;

  return (
    <div className="space-y-6">
      {/* Dataset Type Badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
          <Database className="w-3.5 h-3.5" />
          {profile.type.charAt(0).toUpperCase() + profile.type.slice(1)} Dataset
        </Badge>
        {profile.confidence > 0.5 && (
          <span className="text-xs text-muted-foreground">
            {(profile.confidence * 100).toFixed(0)}% confidence
          </span>
        )}
      </div>

      {/* Before/After Comparison */}
      <div className="glass-card rounded-xl p-5">
        <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Cleaning Summary
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Rows className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Rows</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg font-mono text-muted-foreground">{summary.rowsBefore.toLocaleString()}</span>
              <ArrowRight className="w-3 h-3 text-primary" />
              <span className="text-lg font-mono font-semibold text-foreground">{summary.rowsAfter.toLocaleString()}</span>
            </div>
            {summary.rowsBefore !== summary.rowsAfter && (
              <span className="text-xs text-warning">-{(summary.rowsBefore - summary.rowsAfter).toLocaleString()}</span>
            )}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Columns className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Columns</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg font-mono text-muted-foreground">{summary.columnsBefore}</span>
              <ArrowRight className="w-3 h-3 text-primary" />
              <span className="text-lg font-mono font-semibold text-foreground">{summary.columnsAfter}</span>
            </div>
            {summary.columnsAfter !== summary.columnsBefore && (
              <span className="text-xs text-success">+{summary.columnsAfter - summary.columnsBefore}</span>
            )}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Copy className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Duplicates</span>
            </div>
            <span className="text-lg font-mono font-semibold text-foreground">{summary.duplicatesRemoved}</span>
            {summary.duplicatesRemoved > 0 && (
              <span className="text-xs text-success block">removed</span>
            )}
          </div>

          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Missing Values</span>
            </div>
            <span className="text-lg font-mono font-semibold text-foreground">{summary.missingValuesHandled}</span>
            {summary.missingValuesHandled > 0 && (
              <span className="text-xs text-success block">handled</span>
            )}
          </div>
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Outliers</span>
            <p className="text-sm font-semibold text-foreground">{summary.outliersHandled}</p>
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Columns Renamed</span>
            <p className="text-sm font-semibold text-foreground">{summary.columnsRenamed}</p>
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Types Converted</span>
            <p className="text-sm font-semibold text-foreground">{summary.typesConverted}</p>
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Derived Columns</span>
            <p className="text-sm font-semibold text-foreground">{summary.derivedColumnsCreated}</p>
          </div>
        </div>
      </div>

      {/* Changes Applied */}
      {hasChanges ? (
        <div className="glass-card rounded-xl p-5">
          <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Changes Applied
          </h4>

          <div className="space-y-3">
            {actions.map((action, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors animate-fade-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {getActionIcon(action.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground text-sm">{action.description}</span>
                    <Badge variant="outline" className="flex-shrink-0">
                      {action.count}
                    </Badge>
                  </div>
                  {action.details && action.details.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      {action.details.slice(0, 5).map((detail, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-primary/50" />
                          <span className="truncate">{detail}</span>
                        </div>
                      ))}
                      {action.details.length > 5 && (
                        <span className="text-muted-foreground">...and {action.details.length - 5} more</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
          <h4 className="font-semibold text-foreground mb-1">Dataset Already Clean!</h4>
          <p className="text-sm text-muted-foreground">No issues detected. Ready for analysis.</p>
        </div>
      )}

      {/* Visualization Suggestions */}
      {(profile.suggestedKpis.length > 0 || profile.suggestedFilters.length > 0) && (
        <div className="glass-card rounded-xl p-5">
          <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Visualization Ready
          </h4>

          <div className="grid md:grid-cols-3 gap-4">
            {profile.suggestedKpis.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-sm font-medium text-foreground">Suggested KPIs</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.suggestedKpis.map((kpi, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {kpi}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.suggestedFilters.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Suggested Filters</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.suggestedFilters.map((filter, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {filter}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.suggestedDrilldowns.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Layers className="w-4 h-4 text-warning" />
                  <span className="text-sm font-medium text-foreground">Drill-downs</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.suggestedDrilldowns.map((dd, i) => (
                    <Badge key={i} variant="outline" className="text-xs bg-warning/5">
                      {dd}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Column Profiles */}
      <div className="glass-card rounded-xl p-5">
        <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Columns className="w-4 h-4 text-primary" />
          Column Analysis
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Column</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Role</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Unique</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Issues</th>
              </tr>
            </thead>
            <tbody>
              {profile.columns.slice(0, 15).map((col, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3 font-mono text-xs text-foreground">{col.name}</td>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className="text-xs capitalize">
                      {col.dataType}
                    </Badge>
                  </td>
                  <td className="py-2 px-3">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs capitalize ${
                        col.role === 'measure' ? 'bg-success/10 text-success' :
                        col.role === 'date' ? 'bg-warning/10 text-warning' :
                        col.role === 'identifier' ? 'bg-muted text-muted-foreground' : ''
                      }`}
                    >
                      {col.role}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-center font-mono text-xs">{col.uniqueCount}</td>
                  <td className="py-2 px-3 text-center">
                    {col.issues.length > 0 ? (
                      <Badge variant="destructive" className="text-xs">
                        {col.issues.length}
                      </Badge>
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {profile.columns.length > 15 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Showing 15 of {profile.columns.length} columns
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function getActionIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    remove_duplicates: <Copy className="w-4 h-4 text-primary" />,
    handle_missing: <AlertCircle className="w-4 h-4 text-primary" />,
    handle_outliers: <TrendingUp className="w-4 h-4 text-primary" />,
    rename_columns: <Type className="w-4 h-4 text-primary" />,
    normalize_categorical: <Layers className="w-4 h-4 text-primary" />,
    convert_types: <Zap className="w-4 h-4 text-primary" />,
    trim_whitespace: <Type className="w-4 h-4 text-primary" />,
    create_derived: <Calendar className="w-4 h-4 text-primary" />,
    validate_ranges: <BarChart3 className="w-4 h-4 text-primary" />,
  };
  return icons[type] || <Sparkles className="w-4 h-4 text-primary" />;
}

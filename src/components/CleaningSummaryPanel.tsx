import { CleaningSummary, CleaningAction, DatasetProfile, ColumnQualityMetrics, EnhancedCleaningResult } from '@/lib/dataTypes';
import { 
  Rows, Columns, Copy, AlertCircle, Type, Zap, Calendar, 
  CheckCircle2, TrendingUp, Filter, Layers, BarChart3,
  Database, Sparkles, ArrowRight, Clock, FileText, 
  Gauge, Activity, Info, CalendarDays, Hash, Shield, Lock,
  AlertTriangle, Flag, Eye
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CleaningSummaryPanelProps {
  summary: CleaningSummary;
  actions: CleaningAction[];
  profile: DatasetProfile;
  // Enterprise features
  columnQualityMetrics?: ColumnQualityMetrics[];
  protectedFields?: string[];
  flaggedIds?: { column: string; count: number }[];
  derivedFromImputed?: string[];
}

export function CleaningSummaryPanel({ 
  summary, 
  actions, 
  profile,
  columnQualityMetrics = [],
  protectedFields = [],
  flaggedIds = [],
  derivedFromImputed = []
}: CleaningSummaryPanelProps) {
  const hasChanges = summary.totalChanges > 0;
  const { dataDescription } = profile;

  return (
    <div className="space-y-6">
      {/* Dataset Type & Quality Score */}
      <div className="flex items-center justify-between flex-wrap gap-4">
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
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">Quality Score:</span>
            <Badge 
              variant={dataDescription.dataQualityScore >= 80 ? 'default' : dataDescription.dataQualityScore >= 60 ? 'secondary' : 'destructive'}
              className="font-mono"
            >
              {dataDescription.dataQualityScore}%
            </Badge>
          </div>
        </div>
      </div>

      {/* Data Description Panel */}
      <div className="glass-card rounded-xl p-5">
        <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Data Description
        </h4>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Rows className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{dataDescription.rowCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Rows</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Columns className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{dataDescription.columnCount}</p>
              <p className="text-xs text-muted-foreground">Total Columns</p>
            </div>
          </div>
          
          {dataDescription.dateRange && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <CalendarDays className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground truncate max-w-[150px]" title={dataDescription.dateRange}>
                  {dataDescription.dateRange}
                </p>
                <p className="text-xs text-muted-foreground">Date Range</p>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Hash className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{dataDescription.measureColumns.length}</p>
              <p className="text-xs text-muted-foreground">Measures</p>
            </div>
          </div>
        </div>
        
        {/* Key Metrics */}
        {dataDescription.keyMetrics.length > 0 && (
          <div className="border-t border-border pt-4">
            <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Key Metrics Overview
            </h5>
            <div className="grid md:grid-cols-2 gap-2">
              {dataDescription.keyMetrics.map((metric, idx) => (
                <div key={idx} className="text-xs text-muted-foreground font-mono bg-muted/20 px-3 py-2 rounded">
                  {metric}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Column Types Summary */}
        <div className="grid md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          {dataDescription.timeColumns.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">Date/Time Columns</h5>
              <div className="flex flex-wrap gap-1">
                {dataDescription.timeColumns.slice(0, 3).map((col, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-warning/5">
                    {col}
                  </Badge>
                ))}
                {dataDescription.timeColumns.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{dataDescription.timeColumns.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {dataDescription.measureColumns.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">Measure Columns</h5>
              <div className="flex flex-wrap gap-1">
                {dataDescription.measureColumns.slice(0, 3).map((col, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-success/5">
                    {col}
                  </Badge>
                ))}
                {dataDescription.measureColumns.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{dataDescription.measureColumns.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          {dataDescription.dimensionColumns.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-2">Dimension Columns</h5>
              <div className="flex flex-wrap gap-1">
                {dataDescription.dimensionColumns.slice(0, 3).map((col, i) => (
                  <Badge key={i} variant="outline" className="text-xs bg-primary/5">
                    {col}
                  </Badge>
                ))}
                {dataDescription.dimensionColumns.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{dataDescription.dimensionColumns.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Data Integrity Policy Panel - Enterprise Feature */}
      {(protectedFields.length > 0 || flaggedIds.length > 0 || derivedFromImputed.length > 0) && (
        <div className="glass-card rounded-xl p-5 border-2 border-warning/20">
          <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-warning" />
            Data Integrity Policy Applied
          </h4>
          
          {protectedFields.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-warning" />
                Protected Fields (No Inference)
              </h5>
              <div className="flex flex-wrap gap-2">
                {protectedFields.map((field, idx) => (
                  <Badge key={idx} variant="outline" className="bg-warning/10 text-warning border-warning/30">
                    {field}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                These fields are protected from statistical inference. Missing values set to "Unknown".
              </p>
            </div>
          )}
          
          {flaggedIds.length > 0 && (
            <div className="mb-4">
              <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-destructive" />
                Flagged Missing Identifiers
              </h5>
              <div className="space-y-1">
                {flaggedIds.map((item, idx) => (
                  <div key={idx} className="text-sm text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                    <span>{item.column}: {item.count} missing (not imputed per policy)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {derivedFromImputed.length > 0 && (
            <div>
              <h5 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Eye className="w-3.5 h-3.5 text-primary" />
                Derived from Imputed Dates
              </h5>
              <div className="flex flex-wrap gap-1">
                {derivedFromImputed.slice(0, 5).map((col, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {col}
                  </Badge>
                ))}
                {derivedFromImputed.length > 5 && (
                  <Badge variant="outline" className="text-xs">+{derivedFromImputed.length - 5} more</Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Column Quality Scores - Enterprise Feature */}
      {columnQualityMetrics.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            Per-Column Quality Scores
          </h4>
          <div className="grid gap-2 max-h-[300px] overflow-y-auto">
            {columnQualityMetrics.slice(0, 10).map((metric, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{metric.columnName}</span>
                    {metric.isProtected && (
                      <Lock className="w-3 h-3 text-warning flex-shrink-0" />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Progress value={metric.qualityScore} className="w-20 h-2" />
                  <Badge 
                    variant={metric.qualityScore >= 80 ? 'default' : metric.qualityScore >= 60 ? 'secondary' : 'destructive'}
                    className="font-mono text-xs w-12 justify-center"
                  >
                    {metric.qualityScore}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cleaning Highlights */}
      {dataDescription.cleaningHighlights.length > 0 && (
        <div className="glass-card rounded-xl p-5">
          <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            What Was Done (Plain English)
          </h4>
          <ul className="space-y-2">
            {dataDescription.cleaningHighlights.map((highlight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Outliers</span>
            <p className="text-sm font-semibold text-foreground">{summary.outliersHandled}</p>
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Dates Fixed</span>
            <p className="text-sm font-semibold text-foreground">{summary.datesFixed}</p>
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Interpolated</span>
            <p className="text-sm font-semibold text-foreground">{summary.interpolatedValues}</p>
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Normalized</span>
            <p className="text-sm font-semibold text-foreground">{summary.categoricalNormalized}</p>
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Derived Cols</span>
            <p className="text-sm font-semibold text-foreground">{summary.derivedColumnsCreated}</p>
          </div>
        </div>
      </div>

      {/* Changes Applied */}
      {hasChanges ? (
        <div className="glass-card rounded-xl p-5">
          <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Detailed Changes Applied
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
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Classification</th>
                <th className="text-left py-2 px-3 font-medium text-muted-foreground">Role</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Unique</th>
                <th className="text-center py-2 px-3 font-medium text-muted-foreground">Issues</th>
              </tr>
            </thead>
            <tbody>
              {profile.columns.slice(0, 20).map((col, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2 px-3 font-mono text-xs text-foreground">{col.name}</td>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className="text-xs capitalize">
                      {col.dataType}
                    </Badge>
                  </td>
                  <td className="py-2 px-3">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        col.classification === 'time_series_numeric' ? 'bg-primary/10 text-primary' :
                        col.classification === 'derived' ? 'bg-muted text-muted-foreground' : ''
                      }`}
                    >
                      {col.classification.replace(/_/g, ' ')}
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
          {profile.columns.length > 20 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Showing 20 of {profile.columns.length} columns
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
    fix_dates: <Clock className="w-4 h-4 text-primary" />,
    zero_blank_enforcement: <CheckCircle2 className="w-4 h-4 text-primary" />,
  };
  return icons[type] || <Sparkles className="w-4 h-4 text-primary" />;
}

import { useState } from 'react';
import { ColumnProfile, CleaningConfig } from '@/lib/dataTypes';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Settings, ChevronDown, AlertCircle, Hash, Calendar, 
  Type, ToggleLeft, User, Lock, Info
} from 'lucide-react';

export interface ColumnOverride {
  column: string;
  enabled: boolean;
  imputation?: 'default' | 'mean' | 'median' | 'mode' | 'zero' | 'unknown' | 'skip';
  normalize?: boolean;
  handleOutliers?: boolean;
  isProtected?: boolean; // For gender-like columns
}

interface ColumnConfigPanelProps {
  columns: ColumnProfile[];
  overrides: Record<string, ColumnOverride>;
  onChange: (overrides: Record<string, ColumnOverride>) => void;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'numeric': return <Hash className="w-3.5 h-3.5" />;
    case 'date': return <Calendar className="w-3.5 h-3.5" />;
    case 'boolean': return <ToggleLeft className="w-3.5 h-3.5" />;
    case 'categorical': return <Type className="w-3.5 h-3.5" />;
    default: return <Type className="w-3.5 h-3.5" />;
  }
};

const PROTECTED_COLUMNS = ['gender', 'sex', 'ethnicity', 'race', 'religion', 'disability'];

function isProtectedColumn(name: string): boolean {
  const lowerName = name.toLowerCase();
  return PROTECTED_COLUMNS.some(p => lowerName.includes(p));
}

export function ColumnConfigPanel({ columns, overrides, onChange }: ColumnConfigPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set());

  const toggleColumnExpanded = (name: string) => {
    const newExpanded = new Set(expandedColumns);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedColumns(newExpanded);
  };

  const updateOverride = (column: string, updates: Partial<ColumnOverride>) => {
    const current = overrides[column] || { 
      column, 
      enabled: true, 
      isProtected: isProtectedColumn(column) 
    };
    onChange({
      ...overrides,
      [column]: { ...current, ...updates }
    });
  };

  const getOverride = (column: string): ColumnOverride => {
    return overrides[column] || { 
      column, 
      enabled: true, 
      imputation: 'default',
      normalize: true,
      handleOutliers: true,
      isProtected: isProtectedColumn(column)
    };
  };

  const protectedCount = columns.filter(c => isProtectedColumn(c.name)).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between gap-2 hover:bg-accent transition-colors">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <span>Per-Column Configuration</span>
            {protectedCount > 0 && (
              <Badge variant="secondary" className="ml-2 gap-1">
                <Lock className="w-3 h-3" />
                {protectedCount} Protected
              </Badge>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-4">
        <div className="glass-card rounded-xl p-4 space-y-4 animate-fade-up">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-foreground">Column Settings</h4>
              <Badge variant="outline" className="text-xs">
                {columns.length} columns
              </Badge>
            </div>
          </div>

          {/* Protected Column Warning */}
          {protectedCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <Lock className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Protected Columns Detected</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Gender and similar sensitive columns are protected from inference. 
                  Missing values will be set to "Unknown" and only explicit values will be normalized.
                </p>
              </div>
            </div>
          )}

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {columns.map((col) => {
                const override = getOverride(col.name);
                const isExpanded = expandedColumns.has(col.name);
                const isProtected = isProtectedColumn(col.name);

                return (
                  <div 
                    key={col.name} 
                    className={`border rounded-lg transition-colors ${
                      isProtected ? 'border-warning/30 bg-warning/5' : 'border-border'
                    }`}
                  >
                    <div 
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleColumnExpanded(col.name)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isProtected ? 'bg-warning/10' : 'bg-primary/10'
                        }`}>
                          {isProtected ? (
                            <Lock className={`w-4 h-4 text-warning`} />
                          ) : (
                            getTypeIcon(col.dataType)
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-sm">{col.name}</span>
                            {isProtected && (
                              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                                Protected
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="secondary" className="text-xs">
                              {col.dataType}
                            </Badge>
                            {col.nullCount > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {col.nullCount} missing
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`} />
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/50">
                        {isProtected ? (
                          <div className="flex items-start gap-2 p-2 rounded bg-muted/30">
                            <Info className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-muted-foreground">
                              <p className="font-medium text-foreground">Gender Data Integrity Rule</p>
                              <ul className="mt-1 space-y-1">
                                <li>• Only normalizes explicit values (M/male → Male, F/female → Female)</li>
                                <li>• Missing/invalid values → "Unknown"</li>
                                <li>• No inference from names or patterns</li>
                                <li>• "Unknown" remains filterable</li>
                              </ul>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Enable cleaning</Label>
                              <Switch 
                                checked={override.enabled}
                                onCheckedChange={(v) => updateOverride(col.name, { enabled: v })}
                              />
                            </div>

                            {override.enabled && (
                              <>
                                {col.dataType === 'numeric' && (
                                  <>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-muted-foreground">Missing Value Imputation</Label>
                                      <Select 
                                        value={override.imputation || 'default'}
                                        onValueChange={(v) => updateOverride(col.name, { imputation: v as ColumnOverride['imputation'] })}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="default">Use global setting</SelectItem>
                                          <SelectItem value="mean">Mean</SelectItem>
                                          <SelectItem value="median">Median</SelectItem>
                                          <SelectItem value="mode">Mode</SelectItem>
                                          <SelectItem value="zero">Zero</SelectItem>
                                          <SelectItem value="skip">Skip (keep empty)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs text-muted-foreground">Handle outliers</Label>
                                      <Switch 
                                        checked={override.handleOutliers ?? true}
                                        onCheckedChange={(v) => updateOverride(col.name, { handleOutliers: v })}
                                      />
                                    </div>
                                  </>
                                )}

                                {(col.dataType === 'categorical' || col.dataType === 'text') && (
                                  <>
                                    <div className="space-y-1.5">
                                      <Label className="text-xs text-muted-foreground">Missing Value Handling</Label>
                                      <Select 
                                        value={override.imputation || 'default'}
                                        onValueChange={(v) => updateOverride(col.name, { imputation: v as ColumnOverride['imputation'] })}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="default">Use global setting</SelectItem>
                                          <SelectItem value="unknown">Fill with "Unknown"</SelectItem>
                                          <SelectItem value="mode">Use most common value</SelectItem>
                                          <SelectItem value="skip">Skip (keep empty)</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs text-muted-foreground">Normalize values</Label>
                                      <Switch 
                                        checked={override.normalize ?? true}
                                        onCheckedChange={(v) => updateOverride(col.name, { normalize: v })}
                                      />
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

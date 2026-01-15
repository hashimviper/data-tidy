import { CleaningConfig, DEFAULT_CLEANING_CONFIG } from '@/lib/dataTypes';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Settings2, ChevronDown, RotateCcw } from 'lucide-react';
import { useState } from 'react';

interface CleaningConfigPanelProps {
  config: CleaningConfig;
  onChange: (config: CleaningConfig) => void;
}

export function CleaningConfigPanel({ config, onChange }: CleaningConfigPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateConfig = (updates: Partial<CleaningConfig>) => {
    onChange({ ...config, ...updates });
  };

  const resetToDefaults = () => {
    onChange(DEFAULT_CLEANING_CONFIG);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between gap-2 hover:bg-accent transition-colors">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            <span>Advanced Configuration</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-4">
        <div className="glass-card rounded-xl p-6 space-y-6 animate-fade-up">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-foreground">Cleaning Options</h4>
            <Button variant="ghost" size="sm" onClick={resetToDefaults} className="gap-1 text-muted-foreground hover:text-foreground">
              <RotateCcw className="w-3 h-3" />
              Reset
            </Button>
          </div>

          {/* Missing Values Section */}
          <div className="space-y-4">
            <h5 className="text-sm font-medium text-foreground border-b border-border pb-2">Missing Values</h5>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Numeric Imputation</Label>
                <Select value={config.numericImputation} onValueChange={(v) => updateConfig({ numericImputation: v as CleaningConfig['numericImputation'] })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="median">Median (recommended)</SelectItem>
                    <SelectItem value="mean">Mean</SelectItem>
                    <SelectItem value="mode">Mode</SelectItem>
                    <SelectItem value="zero">Zero</SelectItem>
                    <SelectItem value="remove">Remove rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Categorical Imputation</Label>
                <Select value={config.categoricalImputation} onValueChange={(v) => updateConfig({ categoricalImputation: v as CleaningConfig['categoricalImputation'] })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unknown">Fill with "Unknown"</SelectItem>
                    <SelectItem value="mode">Mode (most common)</SelectItem>
                    <SelectItem value="remove">Remove rows</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Outlier Handling Section */}
          <div className="space-y-4">
            <h5 className="text-sm font-medium text-foreground border-b border-border pb-2">Outlier Handling</h5>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Detection Method</Label>
                <Select value={config.outlierDetection} onValueChange={(v) => updateConfig({ outlierDetection: v as CleaningConfig['outlierDetection'] })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iqr">IQR (Interquartile Range)</SelectItem>
                    <SelectItem value="zscore">Z-Score</SelectItem>
                    <SelectItem value="none">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Handling Method</Label>
                <Select 
                  value={config.outlierHandling} 
                  onValueChange={(v) => updateConfig({ outlierHandling: v as CleaningConfig['outlierHandling'] })}
                  disabled={config.outlierDetection === 'none'}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cap">Cap at bounds</SelectItem>
                    <SelectItem value="flag">Flag only</SelectItem>
                    <SelectItem value="remove">Remove rows</SelectItem>
                    <SelectItem value="none">Keep as-is</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {config.outlierDetection !== 'none' && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-muted-foreground">
                    Threshold ({config.outlierDetection === 'iqr' ? 'IQR multiplier' : 'Z-score'})
                  </Label>
                  <span className="text-sm font-mono text-foreground">{config.outlierThreshold}</span>
                </div>
                <Slider
                  value={[config.outlierThreshold]}
                  onValueChange={([v]) => updateConfig({ outlierThreshold: v })}
                  min={config.outlierDetection === 'iqr' ? 1 : 1}
                  max={config.outlierDetection === 'iqr' ? 3 : 4}
                  step={0.1}
                  className="py-2"
                />
              </div>
            )}
          </div>

          {/* Data Standardization Section */}
          <div className="space-y-4">
            <h5 className="text-sm font-medium text-foreground border-b border-border pb-2">Data Standardization</h5>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Standardize column names</Label>
                  <p className="text-xs text-muted-foreground">Convert to snake_case, remove special chars</p>
                </div>
                <Switch checked={config.standardizeColumnNames} onCheckedChange={(v) => updateConfig({ standardizeColumnNames: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Normalize categorical values</Label>
                  <p className="text-xs text-muted-foreground">Merge similar values (e.g., "M", "Male" → "Male")</p>
                </div>
                <Switch checked={config.normalizeCategorical} onCheckedChange={(v) => updateConfig({ normalizeCategorical: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Trim whitespace</Label>
                  <p className="text-xs text-muted-foreground">Remove leading/trailing spaces</p>
                </div>
                <Switch checked={config.trimWhitespace} onCheckedChange={(v) => updateConfig({ trimWhitespace: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Auto-convert data types</Label>
                  <p className="text-xs text-muted-foreground">Detect and convert numeric, date, boolean</p>
                </div>
                <Switch checked={config.autoConvertTypes} onCheckedChange={(v) => updateConfig({ autoConvertTypes: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Validate value ranges</Label>
                  <p className="text-xs text-muted-foreground">Fix negative prices, percentages &gt; 100, etc.</p>
                </div>
                <Switch checked={config.validateRanges} onCheckedChange={(v) => updateConfig({ validateRanges: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Remove duplicate rows</Label>
                  <p className="text-xs text-muted-foreground">Keep only unique records</p>
                </div>
                <Switch checked={config.removeDuplicates} onCheckedChange={(v) => updateConfig({ removeDuplicates: v })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Create derived date columns</Label>
                  <p className="text-xs text-muted-foreground">Add Year, Quarter, Month from dates</p>
                </div>
                <Switch checked={config.createDateParts} onCheckedChange={(v) => updateConfig({ createDateParts: v })} />
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

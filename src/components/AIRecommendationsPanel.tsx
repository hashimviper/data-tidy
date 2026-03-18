import { SuggestedFix } from '@/lib/aiAnalyzer';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Wand2, ToggleLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIRecommendationsPanelProps {
  fixes: SuggestedFix[];
  onToggleFix: (fixId: string) => void;
  onApplyAll: () => void;
  onToggleAll: (enabled: boolean) => void;
  isApplying?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  fill_missing_with_median: 'Fill with Median',
  fill_missing_with_unknown: 'Fill with "Unknown"',
  convert_to_number: 'Convert to Number',
  standardize_case: 'Standardize Case',
  trim_whitespace: 'Trim Whitespace',
  normalize_dates: 'Normalize Dates',
  cap_outliers: 'Cap Outliers',
  ai_suggested: 'AI Suggestion',
};

function getActionBadgeVariant(action: string): 'default' | 'secondary' | 'outline' {
  if (action === 'ai_suggested') return 'default';
  if (['fill_missing_with_median', 'fill_missing_with_unknown'].includes(action)) return 'secondary';
  return 'outline';
}

export function AIRecommendationsPanel({
  fixes,
  onToggleFix,
  onApplyAll,
  onToggleAll,
  isApplying,
}: AIRecommendationsPanelProps) {
  const enabledCount = fixes.filter(f => f.enabled).length;
  const allEnabled = enabledCount === fixes.length;

  if (fixes.length === 0) return null;

  // Group by column
  const byColumn = new Map<string, SuggestedFix[]>();
  for (const fix of fixes) {
    const list = byColumn.get(fix.column) || [];
    list.push(fix);
    byColumn.set(fix.column, list);
  }

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Wand2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Cleaning Recommendations</h3>
            <p className="text-sm text-muted-foreground">
              {enabledCount} of {fixes.length} actions enabled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleAll(!allEnabled)}
            className="gap-1.5 text-xs"
          >
            <ToggleLeft className="w-3.5 h-3.5" />
            {allEnabled ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[400px]">
        <div className="space-y-4">
          {Array.from(byColumn.entries()).map(([column, columnFixes]) => (
            <div key={column} className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <span className="font-mono text-xs font-medium text-muted-foreground">{column}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              {columnFixes.map((fix) => (
                <label
                  key={fix.id}
                  className={cn(
                    'flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                    fix.enabled
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-border bg-card/30 opacity-60'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Switch
                      checked={fix.enabled}
                      onCheckedChange={() => onToggleFix(fix.id)}
                      className="flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{fix.description}</p>
                      <Badge
                        variant={getActionBadgeVariant(fix.action)}
                        className="text-[10px] mt-1"
                      >
                        {ACTION_LABELS[fix.action] || fix.action}
                      </Badge>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Apply Button */}
      <div className="pt-2 border-t border-border">
        <Button
          onClick={onApplyAll}
          disabled={enabledCount === 0 || isApplying}
          size="lg"
          className="w-full gap-2 shadow-lg shadow-primary/20"
        >
          <Sparkles className="w-4 h-4" />
          {isApplying ? 'Applying...' : `Clean My Data (${enabledCount} action${enabledCount !== 1 ? 's' : ''})`}
        </Button>
      </div>
    </div>
  );
}

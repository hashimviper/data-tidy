import { 
  Upload, Settings2, BarChart3, Download, FileSpreadsheet, 
  Sparkles, Database, ChevronLeft, ChevronRight, Home, Layers,
  Zap, Shield, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DashboardSidebarProps {
  currentStep: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate: (step: number) => void;
  hasData: boolean;
  hasResult: boolean;
}

const navItems = [
  { id: 1, label: 'Upload', icon: Upload, description: 'Import your dataset' },
  { id: 2, label: 'Configure', icon: Settings2, description: 'Set cleaning options' },
  { id: 3, label: 'Clean', icon: Zap, description: 'Process your data' },
  { id: 4, label: 'Analyze', icon: BarChart3, description: 'View insights' },
  { id: 5, label: 'Export', icon: Download, description: 'Download results' },
];

export function DashboardSidebar({ 
  currentStep, 
  collapsed, 
  onToggleCollapse,
  onNavigate,
  hasData,
  hasResult
}: DashboardSidebarProps) {
  const getStepStatus = (stepId: number) => {
    if (stepId === 1) return 'available';
    if (stepId === 2 && hasData) return 'available';
    if (stepId === 3 && hasData) return 'available';
    if (stepId === 4 && hasResult) return 'available';
    if (stepId === 5 && hasResult) return 'available';
    return 'locked';
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "h-screen sticky top-0 flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-xl transition-all duration-300 z-40",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn(
          "flex items-center gap-3 p-4 border-b border-border/50",
          collapsed && "justify-center"
        )}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <Database className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-up">
              <h1 className="font-bold text-foreground">Data Prep Studio</h1>
              <p className="text-[10px] text-muted-foreground">Analysis-ready data</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item, index) => {
            const status = getStepStatus(item.id);
            const isActive = currentStep === item.id;
            const isCompleted = (item.id === 1 && hasData) || 
                               (item.id <= 3 && hasResult) ||
                               (item.id === 4 && hasResult);

            const button = (
              <Button
                key={item.id}
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "w-full justify-start gap-3 h-12 transition-all duration-200 group relative overflow-hidden",
                  collapsed && "justify-center px-0",
                  isActive && "bg-primary/10 text-primary border border-primary/20 shadow-sm",
                  status === 'locked' && "opacity-50 cursor-not-allowed",
                  isCompleted && !isActive && "text-success"
                )}
                onClick={() => status === 'available' && onNavigate(item.id)}
                disabled={status === 'locked'}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                )}
                
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                  isActive ? "bg-primary/20" : "bg-muted/50 group-hover:bg-muted",
                  isCompleted && !isActive && "bg-success/10"
                )}>
                  <item.icon className={cn(
                    "w-4 h-4 transition-transform group-hover:scale-110",
                    isActive && "text-primary",
                    isCompleted && !isActive && "text-success"
                  )} />
                </div>
                
                {!collapsed && (
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">{item.description}</span>
                  </div>
                )}

                {/* Completion dot */}
                {isCompleted && !isActive && !collapsed && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-success animate-pulse" />
                )}
              </Button>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="flex flex-col">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </TooltipContent>
                </Tooltip>
              );
            }

            return button;
          })}
        </nav>

        {/* Quick Stats */}
        {hasResult && !collapsed && (
          <div className="p-3 border-t border-border/50">
            <div className="glass-card rounded-xl p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3 text-primary" />
                <span>Ready for analysis</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 text-center p-2 rounded-lg bg-success/10">
                  <p className="text-lg font-bold text-success">✓</p>
                  <p className="text-[10px] text-muted-foreground">Cleaned</p>
                </div>
                <div className="flex-1 text-center p-2 rounded-lg bg-primary/10">
                  <p className="text-lg font-bold text-primary">↓</p>
                  <p className="text-[10px] text-muted-foreground">Export</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help */}
        <div className="p-3 border-t border-border/50">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="w-full h-10">
                  <HelpCircle className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Help & Support</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="ghost" className="w-full justify-start gap-3 h-10">
              <HelpCircle className="w-4 h-4" />
              <span className="text-sm">Help & Support</span>
            </Button>
          )}
        </div>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-border/50">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onToggleCollapse}
            className={cn("w-full h-10", !collapsed && "justify-start gap-3")}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}

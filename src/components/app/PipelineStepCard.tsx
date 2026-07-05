import { Button } from '@/components/ui/button';
import { GripVertical, X, Pencil } from 'lucide-react';
import { PipelineStep } from '@/store/workspace';

interface Props {
  step: PipelineStep;
  index: number;
  onRemove: () => void;
}

export function PipelineStepCard({ step, index, onRemove }: Props) {
  return (
    <div className="group flex items-center gap-2 rounded-lg border bg-card p-2 text-xs transition-colors hover:border-primary/40">
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{step.label}</div>
        <div className="truncate text-[10px] text-muted-foreground">{step.type}</div>
      </div>
      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
        <Pencil className="h-3 w-3" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={onRemove}>
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

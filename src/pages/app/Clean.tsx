import { useParams, Navigate } from 'react-router-dom';
import { useWorkspace, type PipelineStep } from '@/store/workspace';
import { DataGrid } from '@/components/app/DataGrid';
import { PipelineStepCard } from '@/components/app/PipelineStepCard';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Undo2, Redo2, Play, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const toolbox = {
  Cleaning: [
    { type: 'trim', label: 'Trim whitespace' },
    { type: 'fill_missing', label: 'Fill missing values' },
    { type: 'remove_duplicates', label: 'Remove duplicates' },
    { type: 'fix_types', label: 'Fix column types' },
    { type: 'standardize_text', label: 'Standardize text (lower/title)' },
  ],
  Transform: [
    { type: 'filter', label: 'Filter rows' },
    { type: 'sort', label: 'Sort by column' },
    { type: 'group_by', label: 'Group by & aggregate' },
    { type: 'pivot', label: 'Pivot / Unpivot' },
    { type: 'join', label: 'Join dataset' },
    { type: 'calc', label: 'Calculated column' },
    { type: 'rename', label: 'Rename column' },
  ],
  'Encode / Scale': [
    { type: 'normalize', label: 'Normalize (min-max)' },
    { type: 'standardize', label: 'Standardize (z-score)' },
    { type: 'one_hot', label: 'One-hot encode' },
    { type: 'bucketize', label: 'Bucketize numeric' },
  ],
};

export default function Clean() {
  const { id } = useParams();
  const { datasets, addStep, removeStep, undoStep, redoStep, toggleCopilot } = useWorkspace();
  const ds = datasets.find((d) => d.id === id);
  if (!ds) return <Navigate to="/" replace />;

  const apply = (type: string, label: string) => {
    const step: PipelineStep = {
      id: crypto.randomUUID(),
      type,
      label,
      params: {},
      createdAt: new Date().toISOString(),
    };
    addStep(ds.id, step);
    toast.success(`Added: ${label}`);
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="flex items-center justify-between border-b bg-card/50 px-4 py-2">
        <div>
          <h1 className="text-lg font-semibold">{ds.name}</h1>
          <p className="text-xs text-muted-foreground">Clean & Transform · {ds.pipeline.length} steps</p>
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => undoStep(ds.id)} disabled={ds.pipeline.length === 0}>
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => redoStep(ds.id)} disabled={ds.redoStack.length === 0}>
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => toast.success('Pipeline ready (mock run)')}>
            <Play className="h-3.5 w-3.5" /> Run
          </Button>
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={toggleCopilot}>
            <Sparkles className="h-3.5 w-3.5" /> Ask AI
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-[240px_1fr_260px] gap-0 overflow-hidden">
        <aside className="flex flex-col overflow-hidden border-r">
          <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pipeline
          </div>
          <div className="flex-1 space-y-2 overflow-auto p-3">
            {ds.pipeline.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                No steps yet. Pick a transformation on the right →
              </div>
            ) : (
              ds.pipeline.map((s, i) => (
                <PipelineStepCard key={s.id} step={s} index={i} onRemove={() => removeStep(ds.id, s.id)} />
              ))
            )}
          </div>
        </aside>

        <main className="overflow-hidden p-3">
          <DataGrid rows={ds.rows} editable />
        </main>

        <aside className="flex flex-col overflow-hidden border-l">
          <div className="border-b px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Toolbox
          </div>
          <div className="flex-1 overflow-auto p-2">
            <Accordion type="multiple" defaultValue={['Cleaning', 'Transform']}>
              {Object.entries(toolbox).map(([cat, items]) => (
                <AccordionItem key={cat} value={cat} className="border-none">
                  <AccordionTrigger className="rounded px-2 py-1.5 text-xs font-semibold hover:bg-muted/50">
                    {cat}
                  </AccordionTrigger>
                  <AccordionContent className="pb-2">
                    <div className="space-y-1">
                      {items.map((t) => (
                        <button
                          key={t.type}
                          onClick={() => apply(t.type, t.label)}
                          className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </aside>
      </div>
    </div>
  );
}

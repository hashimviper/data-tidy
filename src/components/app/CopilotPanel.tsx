import { useState, useRef, useEffect } from 'react';
import { useWorkspace, AiMessage } from '@/store/workspace';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { X, Sparkles, Send, Wand2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

const suggestions = [
  'Remove duplicate rows',
  'Fill missing salary with median',
  'Show revenue trend by month',
  'Detect outliers in age column',
];

function mockAiReply(prompt: string): AiMessage {
  const lower = prompt.toLowerCase();
  const explanation = lower.includes('missing')
    ? 'I will impute missing numeric values with the column median and mark categorical missings as "Unknown".'
    : lower.includes('duplicate')
      ? 'I will detect exact duplicate rows across all columns and remove them, preserving the first occurrence.'
      : lower.includes('outlier')
        ? 'I will flag values outside 1.5 × IQR as outliers and optionally cap them to the boundary.'
        : 'Here is a suggested transformation you can apply to your pipeline.';
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    text: explanation,
    createdAt: new Date().toISOString(),
    response: {
      explanation,
      code: {
        python: `# ${prompt}\ndf = df.dropna(subset=['salary'])\ndf['salary'] = df['salary'].fillna(df['salary'].median())`,
        pandas: `df.fillna(df.median(numeric_only=True), inplace=True)`,
        sql: `UPDATE dataset\nSET salary = (SELECT AVG(salary) FROM dataset WHERE salary IS NOT NULL)\nWHERE salary IS NULL;`,
      },
    },
  };
}

export function CopilotPanel() {
  const { copilotOpen, toggleCopilot, aiMessages, addAiMessage, logActivity } = useWorkspace();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [aiMessages, copilotOpen]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: AiMessage = { id: crypto.randomUUID(), role: 'user', text, createdAt: new Date().toISOString() };
    addAiMessage(userMsg);
    setInput('');
    setTimeout(() => addAiMessage(mockAiReply(text)), 500);
  };

  if (!copilotOpen) return null;

  return (
    <aside className="flex w-[380px] flex-col border-l bg-card/60 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <div className="text-sm font-semibold">Data Copilot</div>
            <div className="text-[10px] text-muted-foreground">AI-powered assistant</div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleCopilot}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="space-y-4 p-4">
          {aiMessages.map((m) => (
            <div key={m.id} className={cn('flex flex-col gap-2', m.role === 'user' ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[90%] rounded-2xl px-3 py-2 text-xs',
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}
              >
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
              {m.response && (
                <div className="w-full rounded-lg border bg-background/60 p-2">
                  <Tabs defaultValue="python">
                    <TabsList className="h-7">
                      <TabsTrigger value="python" className="h-5 px-2 text-[10px]">Python</TabsTrigger>
                      <TabsTrigger value="pandas" className="h-5 px-2 text-[10px]">Pandas</TabsTrigger>
                      <TabsTrigger value="sql" className="h-5 px-2 text-[10px]">SQL</TabsTrigger>
                    </TabsList>
                    {(['python', 'pandas', 'sql'] as const).map((k) => (
                      <TabsContent key={k} value={k}>
                        <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 font-mono text-[10px] leading-relaxed">
                          {m.response!.code[k]}
                        </pre>
                      </TabsContent>
                    ))}
                  </Tabs>
                  <Button
                    size="sm"
                    className="mt-2 h-7 w-full gap-1.5"
                    onClick={() => logActivity(`Applied AI suggestion: ${m.text.slice(0, 40)}`)}
                  >
                    <Wand2 className="h-3 w-3" />
                    Apply to pipeline
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="border-t p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {suggestions.map((s) => (
            <button
              key={s}
              className="rounded-full border bg-background px-2 py-1 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
              onClick={() => send(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about your data…"
            className="min-h-[40px] resize-none text-xs"
            rows={1}
          />
          <Button size="icon" onClick={() => send(input)} className="h-10 w-10 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}

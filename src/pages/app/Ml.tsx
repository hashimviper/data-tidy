import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useWorkspace } from '@/store/workspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Brain, Play } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Ml() {
  const { id } = useParams();
  const { datasets } = useWorkspace();
  const ds = datasets.find((d) => d.id === id);
  const [modelType, setModelType] = useState('classification');
  const [target, setTarget] = useState('');
  const [features, setFeatures] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [trained, setTrained] = useState(false);
  const [history, setHistory] = useState<{ name: string; acc: number; f1: number }[]>([]);

  if (!ds) return <Navigate to="/" replace />;

  const train = () => {
    setProgress(0);
    setTrained(false);
    const iv = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(iv);
          setTrained(true);
          const acc = 0.75 + Math.random() * 0.22;
          setHistory((h) => [...h, { name: `${modelType}-${h.length + 1}`, acc, f1: acc - 0.03 }]);
          return 100;
        }
        return p + 6;
      });
    }, 100);
  };

  const importance = ds.schema.slice(0, 6).map((c) => ({
    name: c.name,
    value: Math.round(Math.random() * 100),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ML Studio</h1>
        <p className="mt-1 text-sm text-muted-foreground">Train models on {ds.name}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <div className="mb-1 text-[10px] uppercase text-muted-foreground">Model type</div>
              <Select value={modelType} onValueChange={setModelType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classification">Classification</SelectItem>
                  <SelectItem value="regression">Regression</SelectItem>
                  <SelectItem value="clustering">Clustering</SelectItem>
                  <SelectItem value="forecasting">Forecasting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase text-muted-foreground">Target column</div>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger><SelectValue placeholder="Select target" /></SelectTrigger>
                <SelectContent>
                  {ds.schema.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase text-muted-foreground">Features</div>
              <div className="max-h-52 space-y-1 overflow-auto rounded-lg border p-2">
                {ds.schema.filter((c) => c.name !== target).map((c) => (
                  <label key={c.name} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-muted/50">
                    <Checkbox
                      checked={features.includes(c.name)}
                      onCheckedChange={(v) =>
                        setFeatures((f) => (v ? [...f, c.name] : f.filter((x) => x !== c.name)))
                      }
                    />
                    <span>{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button className="w-full gap-1.5" onClick={train} disabled={!target || features.length === 0}>
              <Play className="h-3.5 w-3.5" /> Train Model
            </Button>
            {progress > 0 && progress < 100 && <Progress value={progress} className="h-1.5" />}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {trained ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: 'Accuracy', v: `${(history[history.length - 1].acc * 100).toFixed(1)}%` },
                  { l: 'F1 Score', v: history[history.length - 1].f1.toFixed(3) },
                  { l: 'Training rows', v: ds.rowCount.toLocaleString() },
                ].map((s) => (
                  <Card key={s.l}>
                    <CardContent className="p-4">
                      <div className="text-[10px] uppercase text-muted-foreground">{s.l}</div>
                      <div className="mt-1 text-2xl font-bold">{s.v}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader><CardTitle className="text-sm">Feature importance</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer>
                      <BarChart data={importance} layout="vertical">
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                        <Tooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Plain-English explanation</CardTitle></CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                  The model correctly predicted <strong>{target || 'the target'}</strong> in{' '}
                  <strong>{(history[history.length - 1].acc * 100).toFixed(0)}%</strong> of cases. The most important
                  features driving predictions were <strong>{importance[0]?.name}</strong> and{' '}
                  <strong>{importance[1]?.name}</strong>.
                </CardContent>
              </Card>
              {history.length > 1 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Model comparison</CardTitle></CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Model</TableHead><TableHead>Accuracy</TableHead><TableHead>F1</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {history.map((h) => (
                          <TableRow key={h.name}>
                            <TableCell>{h.name}</TableCell>
                            <TableCell>{(h.acc * 100).toFixed(1)}%</TableCell>
                            <TableCell>{h.f1.toFixed(3)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Brain className="mb-3 h-10 w-10 text-muted-foreground" />
                <h3 className="text-base font-semibold">No model trained yet</h3>
                <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground">
                  Pick a model type, target column, and features, then click Train.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

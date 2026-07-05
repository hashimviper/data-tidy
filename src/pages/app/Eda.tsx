import { useParams, Navigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useWorkspace } from '@/store/workspace';
import { ChartCard } from '@/components/app/ChartCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { Lightbulb } from 'lucide-react';

const colors = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--destructive))', '#a78bfa'];

export default function Eda() {
  const { id } = useParams();
  const { datasets } = useWorkspace();
  const ds = datasets.find((d) => d.id === id);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'scatter' | 'pie'>('bar');

  const numericCols = ds?.schema.filter((c) => c.type === 'numeric') ?? [];
  const catCols = ds?.schema.filter((c) => c.type === 'categorical') ?? [];

  const [xCol, setXCol] = useState(catCols[0]?.name ?? '');
  const [yCol, setYCol] = useState(numericCols[0]?.name ?? '');

  const aggregated = useMemo(() => {
    if (!ds || !xCol || !yCol) return [];
    const groups = new Map<string, number[]>();
    for (const r of ds.rows) {
      const k = String(r[xCol] ?? 'null');
      const v = Number(r[yCol]);
      if (!Number.isFinite(v)) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(v);
    }
    return Array.from(groups.entries()).map(([k, vs]) => ({
      name: k,
      value: Math.round(vs.reduce((a, b) => a + b, 0) / vs.length),
    }));
  }, [ds, xCol, yCol]);

  if (!ds) return <Navigate to="/" replace />;

  const insights = [
    `${ds.name} has ${ds.rowCount.toLocaleString()} rows across ${ds.colCount} columns.`,
    `Top variability observed in numeric column: ${numericCols[0]?.name ?? '—'}.`,
    `Categorical dominance detected in: ${catCols[0]?.name ?? '—'}.`,
    `Suggested drilldown: analyze ${yCol || 'revenue'} by ${xCol || 'segment'}.`,
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Exploratory Analysis</h1>
        <p className="mt-1 text-sm text-muted-foreground">Build charts and surface insights from {ds.name}.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <Select value={chartType} onValueChange={(v: 'bar' | 'line' | 'scatter' | 'pie') => setChartType(v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="line">Line</SelectItem>
                  <SelectItem value="scatter">Scatter</SelectItem>
                  <SelectItem value="pie">Pie</SelectItem>
                </SelectContent>
              </Select>
              <Select value={xCol} onValueChange={setXCol}>
                <SelectTrigger className="w-40"><SelectValue placeholder="X axis" /></SelectTrigger>
                <SelectContent>
                  {ds.schema.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={yCol} onValueChange={setYCol}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Y axis" /></SelectTrigger>
                <SelectContent>
                  {numericCols.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer>
                  {chartType === 'bar' ? (
                    <BarChart data={aggregated}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : chartType === 'line' ? (
                    <LineChart data={aggregated}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} />
                      <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  ) : chartType === 'scatter' ? (
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="value" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} />
                      <Scatter data={aggregated} fill="hsl(var(--primary))" />
                    </ScatterChart>
                  ) : (
                    <PieChart>
                      <Pie data={aggregated} dataKey="value" nameKey="name" outerRadius={100} label>
                        {aggregated.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} />
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard title="Distribution" subtitle="Auto-generated preview">
              <div className="h-40">
                <ResponsiveContainer>
                  <BarChart data={aggregated.slice(0, 8)}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
            <ChartCard title="Trend" subtitle="Rolling summary">
              <div className="h-40">
                <ResponsiveContainer>
                  <LineChart data={aggregated}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <Line dataKey="value" stroke="hsl(var(--warning))" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Lightbulb className="h-4 w-4 text-warning" />
            <CardTitle className="text-sm">Auto-Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-xs">
              {insights.map((t, i) => (
                <li key={i} className="flex gap-2 rounded-lg border bg-card p-2">
                  <span className="text-primary">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useWorkspace } from '@/store/workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Save, Share2, Plus, X, BarChart3, LineChart as LineIcon, PieChart as PieIcon, Table2, Gauge, Map } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';

type Widget = { id: string; type: 'kpi' | 'bar' | 'line' | 'pie' | 'table' | 'gauge' | 'map' };

const catalog = [
  { type: 'kpi', label: 'KPI Card', icon: Gauge },
  { type: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { type: 'line', label: 'Line Chart', icon: LineIcon },
  { type: 'pie', label: 'Pie Chart', icon: PieIcon },
  { type: 'table', label: 'Table', icon: Table2 },
  { type: 'gauge', label: 'Gauge', icon: Gauge },
  { type: 'map', label: 'Map', icon: Map },
] as const;

const mockData = [
  { name: 'Jan', value: 400 }, { name: 'Feb', value: 300 }, { name: 'Mar', value: 500 },
  { name: 'Apr', value: 700 }, { name: 'May', value: 600 }, { name: 'Jun', value: 800 },
];
const colors = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--success))', '#a78bfa'];

function renderWidget(w: Widget) {
  switch (w.type) {
    case 'kpi':
      return (
        <div className="flex h-full flex-col justify-center p-4">
          <div className="text-[10px] uppercase text-muted-foreground">Total Revenue</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">$328K</div>
          <div className="text-[10px] text-success">↑ 12.4% MoM</div>
        </div>
      );
    case 'bar':
      return (
        <ResponsiveContainer>
          <BarChart data={mockData}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    case 'line':
      return (
        <ResponsiveContainer>
          <LineChart data={mockData}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    case 'pie':
      return (
        <ResponsiveContainer>
          <PieChart>
            <Pie data={mockData.slice(0, 4)} dataKey="value" nameKey="name" outerRadius={60} label>
              {mockData.slice(0, 4).map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );
    case 'table':
      return (
        <div className="p-2 text-[10px]">
          <table className="w-full">
            <thead><tr><th className="text-left">Region</th><th className="text-right">Sales</th></tr></thead>
            <tbody>{mockData.map((d) => <tr key={d.name}><td>{d.name}</td><td className="text-right">${d.value}</td></tr>)}</tbody>
          </table>
        </div>
      );
    case 'gauge':
      return (
        <div className="flex h-full items-center justify-center">
          <div className="relative h-24 w-24 rounded-full border-8 border-primary/20">
            <div className="absolute inset-0 rounded-full border-8 border-transparent border-t-primary" style={{ transform: 'rotate(120deg)' }} />
            <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">76%</div>
          </div>
        </div>
      );
    case 'map':
      return <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/5 to-primary/20 text-xs text-muted-foreground">Map placeholder</div>;
  }
}

export default function DashboardBuilder() {
  const { id } = useParams();
  const { datasets } = useWorkspace();
  const ds = datasets.find((d) => d.id === id);
  const [widgets, setWidgets] = useState<Widget[]>([
    { id: '1', type: 'kpi' },
    { id: '2', type: 'bar' },
    { id: '3', type: 'line' },
    { id: '4', type: 'pie' },
  ]);

  if (!ds) return <Navigate to="/" replace />;

  const add = (type: Widget['type']) => setWidgets((w) => [...w, { id: crypto.randomUUID(), type }]);
  const remove = (id: string) => setWidgets((w) => w.filter((x) => x.id !== id));

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div>
          <h1 className="text-lg font-semibold">Dashboard Builder</h1>
          <p className="text-xs text-muted-foreground">{ds.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Share2 className="mr-1.5 h-3.5 w-3.5" /> Share</Button>
          <Button size="sm"><Save className="mr-1.5 h-3.5 w-3.5" /> Save</Button>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-[220px_1fr] overflow-hidden">
        <aside className="border-r p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Widgets</div>
          <div className="space-y-1">
            {catalog.map((c) => (
              <button
                key={c.type}
                onClick={() => add(c.type)}
                className="flex w-full items-center gap-2 rounded-lg border bg-card p-2 text-xs hover:border-primary/50"
              >
                <c.icon className="h-4 w-4 text-muted-foreground" />
                <span>{c.label}</span>
                <Plus className="ml-auto h-3 w-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        </aside>
        <main className="overflow-auto p-4">
          <div className="grid grid-cols-3 gap-4">
            {widgets.map((w) => (
              <Card key={w.id} className="group relative h-56">
                <button
                  onClick={() => remove(w.id)}
                  className="absolute right-2 top-2 z-10 rounded-full bg-background/80 p-1 opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
                <CardContent className="h-full p-0">{renderWidget(w)}</CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

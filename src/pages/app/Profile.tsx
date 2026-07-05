import { useParams, Navigate, Link } from 'react-router-dom';
import { useWorkspace } from '@/store/workspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QualityRing } from '@/components/app/QualityRing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wand2, AlertTriangle, AlertCircle, Info, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { useState } from 'react';

const severityColor = {
  low: 'bg-blue-500/15 text-blue-500',
  medium: 'bg-amber-500/15 text-amber-600',
  high: 'bg-orange-500/15 text-orange-600',
  critical: 'bg-destructive/15 text-destructive',
};

const severityIcon = {
  low: Info,
  medium: AlertCircle,
  high: AlertTriangle,
  critical: AlertTriangle,
};

export default function Profile() {
  const { id } = useParams();
  const { datasets, toggleCopilot } = useWorkspace();
  const ds = datasets.find((d) => d.id === id);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!ds) return <Navigate to="/" replace />;

  const missingTotal = ds.schema.reduce((a, c) => a + c.nullPct, 0) / (ds.schema.length || 1);
  const dupPct = ds.issues.filter((i) => i.type === 'duplicate').reduce((a, i) => a + i.count, 0) / ds.rowCount * 100;

  const distData = ds.schema.filter((c) => c.type === 'numeric').map((c) => ({
    name: c.name,
    value: c.mean ?? 0,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{ds.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Data profile & quality overview</p>
        </div>
        <Button asChild className="gap-2">
          <Link to={`/datasets/${ds.id}/clean`}>
            Clean & Transform <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: 'Rows', value: ds.rowCount.toLocaleString() },
          { label: 'Columns', value: ds.colCount },
          { label: 'Missing %', value: `${missingTotal.toFixed(1)}%` },
          { label: 'Duplicates %', value: `${dupPct.toFixed(2)}%` },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{s.value}</div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <QualityRing score={ds.quality} size={56} label="quality" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Score</div>
              <div className="text-xs text-muted-foreground">Overall</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Columns</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Null %</TableHead>
                  <TableHead className="text-right">Unique</TableHead>
                  <TableHead>Sample</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ds.schema.map((c) => (
                  <>
                    <TableRow key={c.name} className="cursor-pointer" onClick={() => setExpanded(expanded === c.name ? null : c.name)}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {c.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.nullPct}%</TableCell>
                      <TableCell className="text-right tabular-nums">{c.unique}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-[10px] text-muted-foreground">
                        {c.samples.slice(0, 3).map(String).join(', ')}
                      </TableCell>
                    </TableRow>
                    {expanded === c.name && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-muted/30">
                          <div className="grid grid-cols-3 gap-3 p-2 text-xs">
                            {c.type === 'numeric' ? (
                              <>
                                <div><span className="text-muted-foreground">Min:</span> <span className="font-mono">{c.min}</span></div>
                                <div><span className="text-muted-foreground">Max:</span> <span className="font-mono">{c.max}</span></div>
                                <div><span className="text-muted-foreground">Mean:</span> <span className="font-mono">{c.mean}</span></div>
                              </>
                            ) : (
                              <div className="col-span-3 text-muted-foreground">Top values: {c.samples.slice(0, 5).map(String).join(', ')}</div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Quality Issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ds.issues.length === 0 ? (
              <div className="rounded-lg bg-success/10 p-4 text-sm text-success">✨ No issues detected!</div>
            ) : (
              ds.issues.map((iss) => {
                const Icon = severityIcon[iss.severity];
                return (
                  <div key={iss.id} className="rounded-lg border bg-card p-3">
                    <div className="flex items-start gap-2">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge className={`${severityColor[iss.severity]} border-0 text-[10px]`}>{iss.severity}</Badge>
                          {iss.column && <span className="font-mono text-[10px] text-muted-foreground">{iss.column}</span>}
                        </div>
                        <p className="mt-1 text-xs">{iss.message}</p>
                        <Button size="sm" variant="ghost" className="mt-1 h-6 gap-1 px-1 text-[10px]" onClick={toggleCopilot}>
                          <Wand2 className="h-3 w-3" /> Fix with AI
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Numeric column means</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={distData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

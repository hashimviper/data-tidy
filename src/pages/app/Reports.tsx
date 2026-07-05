import { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useWorkspace } from '@/store/workspace';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const mockReports = [
  { id: 'r1', title: 'Q4 Executive Summary', updated: '2 days ago', sections: 4 },
  { id: 'r2', title: 'Sales Performance Deep Dive', updated: '5 days ago', sections: 6 },
  { id: 'r3', title: 'Data Quality Audit', updated: '1 week ago', sections: 3 },
];

export default function Reports() {
  const { id } = useParams();
  const { datasets } = useWorkspace();
  const ds = datasets.find((d) => d.id === id);
  const [selected, setSelected] = useState(mockReports[0]);

  if (!ds) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Generated insights for {ds.name}</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Report</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-2">
          {mockReports.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={`flex w-full items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors ${
                selected.id === r.id ? 'border-primary/60 bg-accent' : 'hover:border-primary/30'
              }`}
            >
              <FileText className="mt-0.5 h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{r.title}</div>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{r.updated}</span>
                  <span>·</span>
                  <span>{r.sections} sections</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{selected.title}</CardTitle>
            <div className="flex gap-1">
              {['PDF', 'Excel', 'PPT'].map((f) => (
                <Button key={f} variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3 w-3" /> {f}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h3 className="mb-2 text-sm font-semibold">Executive Summary</h3>
              <p className="text-xs text-muted-foreground">
                This dataset of {ds.rowCount.toLocaleString()} rows shows a healthy quality score of {ds.quality}%.
                Key growth drivers were identified across {ds.schema.length} tracked dimensions, with actionable
                opportunities highlighted below.
              </p>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Key Findings</h3>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Overall data completeness: 94%</li>
                <li>• {ds.issues.length} quality issues resolved automatically</li>
                <li>• Detected 3 statistically significant patterns</li>
                <li>• Top-performing segment contributes 38% of total volume</li>
              </ul>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Recommendations</h3>
              <div className="space-y-2">
                {['Focus resources on Enterprise segment', 'Investigate April volume dip', 'Add validation for date column'].map((r) => (
                  <div key={r} className="flex items-start gap-2 rounded-lg border bg-card p-2 text-xs">
                    <Badge variant="outline" className="text-[10px]">Action</Badge>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

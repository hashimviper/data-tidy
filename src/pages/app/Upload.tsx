import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileSpreadsheet, FileJson, FileText, Database } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { useWorkspace, type Dataset } from '@/store/workspace';
import { toast } from 'sonner';

const formats = [
  { ext: 'CSV', icon: FileText, color: 'text-emerald-500' },
  { ext: 'Excel', icon: FileSpreadsheet, color: 'text-green-600' },
  { ext: 'JSON', icon: FileJson, color: 'text-amber-500' },
  { ext: 'TSV', icon: FileText, color: 'text-blue-500' },
  { ext: 'Parquet', icon: Database, color: 'text-purple-500' },
];

export default function Upload() {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const nav = useNavigate();
  const { addDataset, setActiveDataset } = useWorkspace();

  const handleFile = useCallback(
    (file: File) => {
      setProgress(0);
      const iv = setInterval(() => {
        setProgress((p) => {
          if (p == null) return 0;
          if (p >= 100) {
            clearInterval(iv);
            const id = `ds-${Date.now()}`;
            const ext = (file.name.split('.').pop() ?? 'csv').toLowerCase();
            const format = (['csv', 'xlsx', 'json', 'tsv', 'parquet'].includes(ext) ? ext : 'csv') as Dataset['format'];
            const ds: Dataset = {
              id,
              name: file.name.replace(/\.[^.]+$/, ''),
              format,
              rowCount: Math.floor(500 + Math.random() * 5000),
              colCount: 6 + Math.floor(Math.random() * 8),
              quality: 60 + Math.floor(Math.random() * 35),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              schema: [],
              rows: [],
              pipeline: [],
              redoStack: [],
              issues: [],
            };
            addDataset(ds);
            setActiveDataset(id);
            toast.success('Dataset uploaded (mock)');
            setTimeout(() => nav(`/datasets/${id}/profile`), 300);
            return 100;
          }
          return p + 8;
        });
      }, 80);
    },
    [addDataset, nav, setActiveDataset],
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Upload Dataset</h1>
        <p className="mt-1 text-sm text-muted-foreground">Drop a file to start profiling and cleaning.</p>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className={`upload-zone ${dragging ? 'dragging' : ''}`}
      >
        <input
          type="file"
          className="absolute inset-0 cursor-pointer opacity-0"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadCloud className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-semibold">Drag & drop your file</h3>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse from your computer</p>
          </div>
          {progress != null && (
            <div className="w-full max-w-sm space-y-1">
              <Progress value={progress} className="h-1.5" />
              <div className="text-[10px] text-muted-foreground">Uploading… {progress}%</div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-5 gap-2">
        {formats.map((f) => (
          <Card key={f.ext} className="flex flex-col items-center gap-1 p-3">
            <f.icon className={`h-5 w-5 ${f.color}`} />
            <span className="text-[11px] font-medium">{f.ext}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

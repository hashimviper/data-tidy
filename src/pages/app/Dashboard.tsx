import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { QualityRing } from '@/components/app/QualityRing';
import { useWorkspace } from '@/store/workspace';
import { Plus, Database, Clock, Rows3, Columns3, MoreVertical, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { EmptyState } from '@/components/app/EmptyState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Dashboard() {
  const { datasets, activity, removeDataset, setActiveDataset } = useWorkspace();
  const nav = useNavigate();

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {datasets.length} dataset{datasets.length === 1 ? '' : 's'} in your workspace
          </p>
        </div>
        <Button onClick={() => nav('/upload')} className="gap-2">
          <Plus className="h-4 w-4" /> New Dataset
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Datasets</h2>
          {datasets.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No datasets yet"
              description="Upload your first dataset to start profiling, cleaning, and exploring."
              action={
                <Button onClick={() => nav('/upload')} className="gap-2">
                  <Plus className="h-4 w-4" /> Upload dataset
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {datasets.map((d) => (
                <Card key={d.id} className="group relative overflow-hidden transition-all hover:shadow-md hover:shadow-primary/5">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{d.name}</CardTitle>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="outline" className="uppercase text-[10px]">
                          {d.format}
                        </Badge>
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => removeDataset(d.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardHeader>
                  <CardContent>
                    <Link
                      to={`/datasets/${d.id}/profile`}
                      onClick={() => setActiveDataset(d.id)}
                      className="flex items-center gap-4"
                    >
                      <QualityRing score={d.quality} size={56} label="quality" />
                      <div className="flex-1 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Rows3 className="h-3 w-3" />
                          <span className="tabular-nums">{d.rowCount.toLocaleString()} rows</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Columns3 className="h-3 w-3" />
                          <span className="tabular-nums">{d.colCount} columns</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Issues:</span>
                          <span className="font-medium">{d.issues.length}</span>
                        </div>
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Activity</h2>
          <Card>
            <CardContent className="p-0">
              {activity.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No activity yet</div>
              ) : (
                <ul className="divide-y">
                  {activity.slice(0, 10).map((a) => (
                    <li key={a.id} className="p-3 text-xs">
                      <div className="font-medium">{a.text}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(a.at), { addSuffix: true })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

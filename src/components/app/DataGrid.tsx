import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DataGridProps {
  rows: Record<string, unknown>[];
  columns?: string[];
  pageSize?: number;
  editable?: boolean;
}

export function DataGrid({ rows, columns, pageSize = 50, editable = false }: DataGridProps) {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const [sort, setSort] = useState<{ col: string; dir: 'asc' | 'desc' } | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let out = rows;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      out = out.filter((r) => cols.some((c) => String(r[c] ?? '').toLowerCase().includes(q)));
    }
    if (sort) {
      out = [...out].sort((a, b) => {
        const av = a[sort.col];
        const bv = b[sort.col];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
        return sort.dir === 'asc'
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return out;
  }, [rows, cols, filter, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const view = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (c: string) =>
    setSort((s) => (s?.col === c ? (s.dir === 'asc' ? { col: c, dir: 'desc' } : null) : { col: c, dir: 'asc' }));

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter rows…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
            className="h-8 pl-7 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length.toLocaleString()} row{filtered.length === 1 ? '' : 's'}
        </span>
      </div>
      <ScrollArea className="flex-1">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="w-10 text-center">#</th>
              {cols.map((c) => (
                <th key={c}>
                  <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort(c)}>
                    {c}
                    {sort?.col === c ? (
                      sort.dir === 'asc' ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ArrowUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r, i) => (
              <tr key={i}>
                <td className="text-center text-muted-foreground">{page * pageSize + i + 1}</td>
                {cols.map((c) => (
                  <td key={c} className="max-w-[220px] truncate">
                    {r[c] == null ? (
                      <span className="italic text-muted-foreground/60">null</span>
                    ) : editable ? (
                      <input
                        defaultValue={String(r[c])}
                        className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded px-1"
                      />
                    ) : (
                      String(r[c])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <div className="flex items-center justify-between border-t p-2 text-xs">
        <span className="text-muted-foreground">
          Page {page + 1} / {pages}
        </span>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" className="h-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

import { ScrollArea } from '@/components/ui/scroll-area';

interface DataTableProps {
  data: Record<string, unknown>[];
  maxRows?: number;
}

export function DataTable({ data, maxRows = 50 }: DataTableProps) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No data to display
      </div>
    );
  }

  const columns = Object.keys(data[0]);
  const displayData = data.slice(0, maxRows);

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <ScrollArea className="h-[400px]">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                {columns.map((col) => (
                  <th key={col} className="whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayData.map((row, idx) => (
                <tr key={idx}>
                  <td className="text-center text-muted-foreground">
                    {idx + 1}
                  </td>
                  {columns.map((col) => (
                    <td key={col} className="max-w-[200px] truncate">
                      {row[col] === null || row[col] === undefined
                        ? <span className="text-muted-foreground/50 italic">null</span>
                        : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
      
      {data.length > maxRows && (
        <div className="px-4 py-3 bg-muted/30 border-t border-border text-center">
          <span className="text-sm text-muted-foreground">
            Showing {maxRows} of {data.length} rows
          </span>
        </div>
      )}
    </div>
  );
}

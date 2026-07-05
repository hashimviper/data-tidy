import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { useWorkspace } from '@/store/workspace';
import { toast } from 'sonner';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { storagePath, setStoragePath, clearAiMessages } = useWorkspace();

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Preferences and workspace configuration</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <Button key={t} variant={theme === t ? 'default' : 'outline'} size="sm" onClick={() => setTheme(t)} className="capitalize">
                {t}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Local Storage</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Data folder path</Label>
            <Input value={storagePath} onChange={(e) => setStoragePath(e.target.value)} className="font-mono text-xs" />
            <p className="text-[10px] text-muted-foreground">Local-first: datasets are saved to this location.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">AI Copilot</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => { clearAiMessages(); toast.success('Chat history cleared'); }}>
            Clear chat history
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">About</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs text-muted-foreground">
          <div><strong className="text-foreground">DataTidy</strong> · Local-first AI data workspace</div>
          <div>Version 0.1.0 · Frontend preview build</div>
        </CardContent>
      </Card>
    </div>
  );
}

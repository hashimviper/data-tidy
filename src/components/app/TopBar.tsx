import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Command, Sparkles, Sun, Moon } from 'lucide-react';
import { useWorkspace } from '@/store/workspace';
import { useLocation, useParams, Link } from 'react-router-dom';
import { useTheme } from 'next-themes';

export function TopBar() {
  const { setCommandOpen, toggleCopilot, datasets } = useWorkspace();
  const { pathname } = useLocation();
  const params = useParams();
  const { theme, setTheme } = useTheme();
  const ds = datasets.find((d) => d.id === params.id);

  const crumbs: { label: string; to?: string }[] = [{ label: 'DataTidy', to: '/' }];
  if (ds) {
    crumbs.push({ label: ds.name, to: `/datasets/${ds.id}/profile` });
    const seg = pathname.split('/').pop() ?? '';
    if (seg && seg !== ds.id) crumbs.push({ label: seg.charAt(0).toUpperCase() + seg.slice(1) });
  } else if (pathname !== '/') {
    crumbs.push({ label: pathname.replace('/', '').charAt(0).toUpperCase() + pathname.slice(2) });
  }

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <nav className="flex items-center gap-1 text-xs">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/50">/</span>}
            {c.to ? (
              <Link to={c.to} className="text-muted-foreground hover:text-foreground">
                {c.label}
              </Link>
            ) : (
              <span className="font-medium">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-2 px-2 text-xs text-muted-foreground"
          onClick={() => setCommandOpen(true)}
        >
          <Command className="h-3 w-3" />
          <span className="hidden sm:inline">Quick actions</span>
          <kbd className="ml-2 hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">⌘K</kbd>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="default" size="sm" className="h-8 gap-1.5" onClick={toggleCopilot}>
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Copilot</span>
        </Button>
      </div>
    </header>
  );
}

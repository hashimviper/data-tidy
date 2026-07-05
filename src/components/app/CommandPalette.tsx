import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useWorkspace } from '@/store/workspace';
import { Home, Upload, Sparkles, Database, Settings, Wand2, ChartBar } from 'lucide-react';

export function CommandPalette() {
  const nav = useNavigate();
  const { commandOpen, setCommandOpen, datasets, toggleCopilot } = useWorkspace();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [commandOpen, setCommandOpen]);

  const go = (path: string) => {
    setCommandOpen(false);
    nav(path);
  };

  return (
    <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go('/')}>
            <Home className="mr-2 h-4 w-4" /> Home
          </CommandItem>
          <CommandItem onSelect={() => go('/upload')}>
            <Upload className="mr-2 h-4 w-4" /> Upload dataset
          </CommandItem>
          <CommandItem onSelect={() => go('/settings')}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              setCommandOpen(false);
              toggleCopilot();
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Toggle AI Copilot
          </CommandItem>
        </CommandGroup>
        {datasets.length > 0 && (
          <CommandGroup heading="Datasets">
            {datasets.map((d) => (
              <CommandItem key={d.id} onSelect={() => go(`/datasets/${d.id}/profile`)}>
                <Database className="mr-2 h-4 w-4" /> {d.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {datasets[0] && (
          <CommandGroup heading="Quick">
            <CommandItem onSelect={() => go(`/datasets/${datasets[0].id}/clean`)}>
              <Wand2 className="mr-2 h-4 w-4" /> Clean active dataset
            </CommandItem>
            <CommandItem onSelect={() => go(`/datasets/${datasets[0].id}/eda`)}>
              <ChartBar className="mr-2 h-4 w-4" /> Explore charts
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

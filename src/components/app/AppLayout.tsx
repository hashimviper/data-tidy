import { Outlet } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { TopBar } from './TopBar';
import { CopilotPanel } from './CopilotPanel';
import { CommandPalette } from './CommandPalette';

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <TopBar />
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-auto">
              <Outlet />
            </main>
            <CopilotPanel />
          </div>
        </div>
        <CommandPalette />
      </div>
    </SidebarProvider>
  );
}

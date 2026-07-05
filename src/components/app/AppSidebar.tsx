import { NavLink, useLocation, useParams } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Home,
  Upload,
  Table2,
  Wand2,
  ChartBar,
  LayoutDashboard,
  Brain,
  FileText,
  Settings,
  Database,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useWorkspace } from '@/store/workspace';
import { cn } from '@/lib/utils';

const globalNav = [
  { title: 'Home', url: '/', icon: Home, end: true },
  { title: 'Upload', url: '/upload', icon: Upload },
  { title: 'Settings', url: '/settings', icon: Settings },
];

const workspaceNav = (id: string) => [
  { title: 'Profile', url: `/datasets/${id}/profile`, icon: Table2 },
  { title: 'Clean & Transform', url: `/datasets/${id}/clean`, icon: Wand2 },
  { title: 'EDA', url: `/datasets/${id}/eda`, icon: ChartBar },
  { title: 'Dashboard', url: `/datasets/${id}/dashboard`, icon: LayoutDashboard },
  { title: 'ML Studio', url: `/datasets/${id}/ml`, icon: Brain },
  { title: 'Reports', url: `/datasets/${id}/reports`, icon: FileText },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();
  const params = useParams();
  const { datasets, activeDatasetId } = useWorkspace();
  const activeId = params.id || activeDatasetId || datasets[0]?.id;
  const activeDs = datasets.find((d) => d.id === activeId);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <NavLink to="/" className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">DataTidy</span>
              <span className="text-[10px] text-muted-foreground">AI Data Workspace</span>
            </div>
          )}
        </NavLink>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {globalNav.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={item.end ? pathname === item.url : pathname.startsWith(item.url)}>
                    <NavLink to={item.url} end={item.end}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {activeDs && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-1.5">
              <Database className="h-3 w-3" />
              {!collapsed && <span className="truncate">{activeDs.name}</span>}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {workspaceNav(activeDs.id).map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={pathname === item.url}>
                      <NavLink to={item.url}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {datasets.length > 0 && !collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel>All Datasets</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {datasets.slice(0, 6).map((d) => (
                  <SidebarMenuItem key={d.id}>
                    <SidebarMenuButton asChild isActive={activeId === d.id}>
                      <NavLink to={`/datasets/${d.id}/profile`}>
                        <div className={cn('h-1.5 w-1.5 rounded-full', d.quality >= 85 ? 'bg-success' : d.quality >= 65 ? 'bg-warning' : 'bg-destructive')} />
                        <span className="truncate">{d.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/legacy-cleaner">
                <Wrench className="h-4 w-4" />
                {!collapsed && <span className="text-xs">Legacy Cleaner</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

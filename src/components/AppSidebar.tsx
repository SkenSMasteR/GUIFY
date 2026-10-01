import {
  LayoutDashboard,
  Boxes,
  Package,
  Settings,
  Scissors,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
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
  SidebarRail,
} from "@/components/ui/sidebar";
import { useApp, type View } from "@/lib/store";

const mainItems: { view: View; label: string; icon: LucideIcon }[] = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "browse", label: "Browse Modules", icon: Boxes },
  { view: "installed", label: "Installed", icon: Package },
  { view: "snippets", label: "Custom snippets", icon: Scissors },
];

export function AppSidebar() {
  const { view, setView, advanced, status } = useApp();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <button onClick={() => setView("dashboard")}>
                <img
                  src="/logo.png"
                  alt=""
                  className="size-8 rounded-lg object-cover"
                  draggable={false}
                />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">GUIFY</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {status?.installed ? `Spicetify ${status.version}` : "Spicetify not found"}
                  </span>
                </div>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((it) => (
                <SidebarMenuItem key={it.view}>
                  <SidebarMenuButton
                    tooltip={it.label}
                    isActive={view === it.view}
                    onClick={() => setView(it.view)}
                  >
                    <it.icon />
                    <span>{it.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {advanced && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Advanced"
                    isActive={view === "advanced"}
                    onClick={() => setView("advanced")}
                  >
                    <Sparkles />
                    <span>Advanced</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Settings"
              isActive={view === "settings"}
              onClick={() => setView("settings")}
            >
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

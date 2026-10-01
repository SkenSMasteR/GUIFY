import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { MissionControl } from "@/components/MissionControl";
import { ApplyPill } from "@/components/ApplyPill";
import { AppProvider, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Splash } from "@/components/Splash";
import { Dashboard } from "@/views/Dashboard";
import { BrowseModules } from "@/views/BrowseModules";
import { Installed } from "@/views/Installed";
import { Snippets } from "@/views/Snippets";
import { Advanced } from "@/views/Advanced";
import { Settings } from "@/views/Settings";

function CurrentView() {
  const { view } = useApp();
  switch (view) {
    case "browse":
      return <BrowseModules />;
    case "installed":
      return <Installed />;
    case "snippets":
      return <Snippets />;
    case "advanced":
      return <Advanced />;
    case "settings":
      return <Settings />;
    default:
      return <Dashboard />;
  }
}

function Shell() {
  const { logOpen } = useApp();
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex h-screen flex-col">
        <AppHeader />
        <div className="flex min-h-0 flex-1">
          <ScrollArea className="min-h-0 flex-1">
            <CurrentView />
          </ScrollArea>
          <div
            className={cn(
              "shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-in-out",
              logOpen ? "w-[360px] opacity-100" : "w-0 opacity-0",
            )}
          >
            <MissionControl />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function Boot() {
  const { booting } = useApp();
  return (
    <>
      <div className="flex h-screen w-full overflow-hidden">
        <Shell />
      </div>
      <ApplyPill />
      {booting && <Splash />}
    </>
  );
}

export default function App() {
  return (
    <TooltipProvider>
      <AppProvider>
        <Boot />
        <Toaster theme="dark" richColors position="bottom-right" />
      </AppProvider>
    </TooltipProvider>
  );
}

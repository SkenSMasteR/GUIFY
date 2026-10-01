import { useEffect, useState, type ReactNode } from "react";
import { Minus, Plus, Square, X, Terminal, PanelRight } from "lucide-react";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { getWindowControls, openUrl, type WindowControls } from "@/lib/api";
import { closeWindow, isMaximized, minimize, toggleMaximize } from "@/lib/window";

function MacDot({
  color,
  title,
  onClick,
  children,
}: {
  color: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex size-3 items-center justify-center rounded-full ${color}`}
    >
      <span className="text-black/60 opacity-0 transition-opacity group-hover/mac:opacity-100">
        {children}
      </span>
    </button>
  );
}

export function AppHeader() {
  const {
    view,
    setView,
    advanced,
    setAdvanced,
    watchOn,
    toggleWatch,
    refreshStatus,
    refreshLocal,
    loadBrowse,
    run,
    fix,
    logOpen,
    setLogOpen,
  } = useApp();
  const [maximized, setMaximized] = useState(false);
  const [controls, setControls] = useState<WindowControls | null>(null);

  useEffect(() => {
    getWindowControls().then(setControls).catch(() => setControls("windows"));
  }, []);

  useEffect(() => {
    isMaximized().then(setMaximized).catch(() => {});
  }, [logOpen, view]);

  const refreshAll = () => {
    void refreshStatus();
    void refreshLocal();
    void loadBrowse(true);
  };

  return (
    <header
      data-tauri-drag-region
      className="bg-background/80 sticky top-0 z-30 flex h-11 shrink-0 items-center gap-1 border-b px-2 backdrop-blur select-none"
    >
      {controls === "macos" && (
        <div className="group/mac ml-1 mr-2 flex items-center gap-2" data-tauri-drag-region>
          <MacDot color="bg-[#ff5f57]" title="Close" onClick={() => void closeWindow()}>
            <X className="size-2 stroke-[2.5]" />
          </MacDot>
          <MacDot color="bg-[#febc2e]" title="Minimize" onClick={() => void minimize()}>
            <Minus className="size-2 stroke-[2.5]" />
          </MacDot>
          <MacDot
            color="bg-[#28c840]"
            title={maximized ? "Restore" : "Zoom"}
            onClick={async () => {
              await toggleMaximize();
              setMaximized(await isMaximized().catch(() => false));
            }}
          >
            <Plus className="size-2 stroke-[2.5]" />
          </MacDot>
        </div>
      )}
      <SidebarTrigger className="h-7 w-7" />
      <img src="/logo.png" alt="" className="pointer-events-none mx-1 size-5" draggable={false} />
      <span data-tauri-drag-region className="text-muted-foreground pointer-events-none text-xs font-semibold tracking-wide">
        GUIFY
      </span>

      <div className="pointer-events-auto ml-2" data-tauri-drag-region>
        <Menubar className="h-8 border-none bg-transparent">
          <MenubarMenu>
            <MenubarTrigger className="h-7 text-xs">File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={refreshAll}>Refresh</MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => void openUrl("https://spicetify.app")}>
                Open spicetify.app
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="h-7 text-xs">View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => setView("dashboard")}>Dashboard</MenubarItem>
              <MenubarItem onClick={() => setView("browse")}>Browse Modules</MenubarItem>
              <MenubarItem onClick={() => setView("installed")}>Installed</MenubarItem>
              <MenubarItem onClick={() => setView("snippets")}>Custom snippets</MenubarItem>
              <MenubarItem onClick={() => setView("settings")}>Settings</MenubarItem>
              <MenubarSeparator />
              <MenubarCheckboxItem checked={advanced} onCheckedChange={(v) => setAdvanced(Boolean(v))}>
                Advanced mode
              </MenubarCheckboxItem>
              <MenubarCheckboxItem checked={watchOn} onCheckedChange={() => void toggleWatch()}>
                Auto-apply (watch)
              </MenubarCheckboxItem>
              <MenubarCheckboxItem checked={logOpen} onCheckedChange={(v) => setLogOpen(Boolean(v))}>
                Mission Control
              </MenubarCheckboxItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="h-7 text-xs">Spicetify</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => void run("apply")}>Apply</MenubarItem>
              <MenubarItem onClick={() => void run("backup")}>Backup</MenubarItem>
              <MenubarItem onClick={() => void run("restore")}>Restore</MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => void fix()}>Fix Spicetify</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger className="h-7 text-xs">Help</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => void openUrl("https://spicetify.app/docs/cli")}>
                CLI reference
              </MenubarItem>
              <MenubarItem onClick={() => void openUrl("https://github.com/SkenSMasteR/GUIFY")}>
                GUIFY on GitHub
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </div>

      <div className="ml-auto flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Log & commands"
          onClick={() => setLogOpen(!logOpen)}
        >
          {logOpen ? <PanelRight className="size-4" /> : <Terminal className="size-4" />}
        </Button>
        <div className="ml-1 flex items-center">
          {controls !== "macos" && controls !== "hyprland" && (
            <>
              <button
                onClick={() => void minimize()}
                className="hover:bg-accent flex h-8 w-11 items-center justify-center rounded-sm"
                title="Minimize"
              >
                <Minus className="size-4" />
              </button>
              <button
                onClick={async () => {
                  await toggleMaximize();
                  setMaximized(await isMaximized().catch(() => false));
                }}
                className="hover:bg-accent flex h-8 w-11 items-center justify-center rounded-sm"
                title={maximized ? "Restore" : "Maximize"}
              >
                <Square className="size-3.5" />
              </button>
            </>
          )}
          {controls !== "macos" && (
            <button
              onClick={() => void closeWindow()}
              className="hover:bg-destructive hover:text-destructive-foreground flex h-8 w-11 items-center justify-center rounded-sm"
              title="Close"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

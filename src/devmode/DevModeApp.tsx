import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Braces, Minus, Plus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { getWindowControls, type WindowControls } from "@/lib/api";
import { closeWindow, isMaximized, minimize, toggleMaximize } from "@/lib/window";
import { DevModeProvider, useDevMode } from "./store";
import { ProjectsView } from "./ProjectsView";

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

function EditorPlaceholder() {
  const { activeProject, backToProjects } = useDevMode();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
        <Braces className="size-7" />
      </div>
      <p className="text-lg font-medium">{activeProject?.name}</p>
      <p className="text-muted-foreground max-w-sm text-center text-sm">
        Add this later with CodeMirror 6 ❤️
      </p>
      <Button variant="outline" size="sm" onClick={backToProjects}>
        Back to projects
      </Button>
    </div>
  );
}

function DevModeBody() {
  const { screen, backToProjects } = useDevMode();
  const { setMode } = useApp();
  const [maximized, setMaximized] = useState(false);
  const [controls, setControls] = useState<WindowControls | null>(null);

  useEffect(() => {
    getWindowControls().then(setControls).catch(() => setControls("windows"));
  }, []);

  useEffect(() => {
    isMaximized().then(setMaximized).catch(() => {});
  }, [screen]);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <header
        data-tauri-drag-region
        className="bg-background/80 flex h-11 shrink-0 items-center gap-1 border-b px-2 backdrop-blur select-none"
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
        <Button variant="ghost" size="sm" onClick={() => setMode("guify")}>
          <ArrowLeft />
          <span>Exit DevMode</span>
        </Button>
        <span data-tauri-drag-region className="truncate font-semibold">
          DevMode
        </span>
        {screen === "editor" && (
          <>
            <span data-tauri-drag-region className="text-muted-foreground">
              /
            </span>
            <Button variant="ghost" size="sm" onClick={backToProjects}>
              Projects
            </Button>
          </>
        )}

        <div className="ml-auto flex items-center">
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
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {screen === "projects" ? <ProjectsView /> : <EditorPlaceholder />}
      </main>
    </div>
  );
}

export function DevModeApp() {
  return (
    <DevModeProvider>
      <DevModeBody />
    </DevModeProvider>
  );
}

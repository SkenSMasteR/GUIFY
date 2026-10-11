import { ArrowLeft, Braces } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useApp } from "@/lib/store";
import { DevModeProvider, useDevMode } from "./store";
import { ProjectsView } from "./ProjectsView";

function EditorPlaceholder() {
  const { activeProject, backToProjects } = useDevMode();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3">
      <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
        <Braces className="size-7" />
      </div>
      <p className="text-lg font-medium">{activeProject?.name}</p>
      <p className="text-muted-foreground max-w-sm text-center text-sm">
        Add this later with CodeMirror 6 <3
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
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => setMode("guify")}>
          <ArrowLeft />
          <span>Exit DevMode</span>
        </Button>
        <span className="truncate font-semibold">DevMode</span>
        {screen === "editor" && (
          <>
            <span className="text-muted-foreground">/</span>
            <Button variant="ghost" size="sm" onClick={backToProjects}>
              Projects
            </Button>
          </>
        )}
      </header>
      <Separator />
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

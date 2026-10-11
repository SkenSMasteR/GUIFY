import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useApp } from "@/lib/store";

export function DevModeApp() {
  const { setMode } = useApp();
  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      <header className="flex items-center gap-3 px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => setMode("guify")}>
          <ArrowLeft />
          <span>Exit DevMode</span>
        </Button>
        <span className="truncate font-semibold">DevMode</span>
      </header>
      <Separator />
      <main className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-muted-foreground text-sm">Projects will appear here.</p>
      </main>
    </div>
  );
}

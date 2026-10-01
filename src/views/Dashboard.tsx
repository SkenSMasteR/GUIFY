import {
  Palette,
  Play,
  Search,
  AlertTriangle,
  Package,
  Puzzle,
  ArrowUpCircle,
  Wrench,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { openUrl } from "@/lib/api";
import { useApp } from "@/lib/store";

export function Dashboard() {
  const {
    status,
    setView,
    run,
    update,
    fix,
    busy,
    localThemes,
    enabledExtensions,
    updateAvailable,
    pending,
    applyChanges,
    activeTheme,
  } = useApp();

  if (!status || !status.installed) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Spicetify not found</AlertTitle>
          <AlertDescription>
            GUIFY needs Spicetify installed and on your PATH. Install it, then reopen the app.
            <div className="mt-3">
              <Button size="sm" onClick={() => void openUrl("https://spicetify.app/docs/getting-started")}>
                Installation guide
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const themeName =
    activeTheme && activeTheme !== "Spicetify Default" ? activeTheme : null;

  return (
    <div className="grid gap-4 p-6">
      {updateAvailable && (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <div className="bg-primary/20 flex size-10 items-center justify-center rounded-full">
              <ArrowUpCircle className="text-primary size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Spicetify {updateAvailable} is available</p>
              <p className="text-muted-foreground text-xs">You're on {status.version}. Update to stay compatible.</p>
            </div>
            <Button size="sm" className="ml-auto" onClick={() => void update()} disabled={busy === "update"}>
              Update now
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="relative overflow-hidden border-border/60">
        <CardContent className="relative flex flex-wrap items-center gap-4 py-6">
          <div className="bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-2xl shadow-lg">
            <Palette className="size-7" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Current theme</p>
            <p className="truncate text-2xl font-semibold">{themeName ?? "Spicetify Default"}</p>
            {status.colorScheme && (
              <Badge variant="secondary" className="mt-1">{status.colorScheme}</Badge>
            )}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setView("browse")}>
              <Search /> Browse
            </Button>
            {pending ? (
              <Button onClick={() => void applyChanges()} disabled={busy === "apply"}>
                <Play /> Apply changes
              </Button>
            ) : (
              <Button onClick={() => void run("apply")} disabled={busy === "apply"}>
                <Play /> Apply
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat icon={Package} label="Themes installed" value={localThemes.length} />
        <Stat icon={Puzzle} label="Extensions on" value={enabledExtensions.length} />
        <Stat icon={Sparkles} label="Spicetify" value={status.version} />
      </div>

      <Card className="border-border/60">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <div className="bg-muted flex size-10 items-center justify-center rounded-full">
            <Wrench className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Having trouble after a Spotify update?</p>
            <p className="text-muted-foreground text-xs">
              Runs update, restore and backup apply to repair your install.
            </p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => void fix()} disabled={busy === "fix"}>
            Fix Spicetify
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="group border-border/60 transition-colors hover:border-primary/40">
      <CardContent className="flex items-center gap-3 py-5">
        <div className="bg-muted flex size-11 items-center justify-center rounded-xl">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold">{value}</p>
          <p className="text-muted-foreground truncate text-xs">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

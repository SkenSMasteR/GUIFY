import { RefreshCw, Wrench, Bug } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { openUrl } from "@/lib/api";
import { useApp } from "@/lib/store";

export function Settings() {
  const {
    advanced,
    setAdvanced,
    autoApply,
    setAutoApply,
    watchOn,
    toggleWatch,
    devtools,
    toggleDevtools,
    refreshStatus,
    refreshLocal,
    loadBrowse,
    fix,
    busy,
    status,
  } = useApp();

  const refreshAll = () => {
    void refreshStatus();
    void refreshLocal();
    void loadBrowse(true);
  };

  return (
    <div className="grid gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Appearance &amp; detail</CardTitle>
          <CardDescription>
            Advanced mode adds an Advanced tab with paths, raw config and quick commands.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label htmlFor="adv" className="text-sm font-medium">Advanced mode</Label>
          <Switch id="adv" checked={advanced} onCheckedChange={(v) => setAdvanced(v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-apply</CardTitle>
          <CardDescription>
            Apply changes automatically after installing or switching themes and extensions. Watch
            re-applies your theme whenever Spotify or theme files change.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="autoapply" className="text-sm font-medium">
              Apply changes automatically
            </Label>
            <Switch id="autoapply" checked={autoApply} onCheckedChange={(v) => setAutoApply(v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="watch" className="text-sm font-medium">Watch for changes</Label>
            <Switch id="watch" checked={watchOn} onCheckedChange={() => void toggleWatch()} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Developer tools</CardTitle>
          <CardDescription>Open the GUIFY webview inspector.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label htmlFor="devtools" className="text-sm font-medium">Enable devtools</Label>
          <Switch id="devtools" checked={devtools} onCheckedChange={(v) => toggleDevtools(v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
          <CardDescription>Reload data, or repair Spicetify after a Spotify update.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshAll}>
            <RefreshCw /> Refresh everything
          </Button>
          <Button variant="outline" onClick={() => void fix()} disabled={busy === "fix"}>
            <Wrench /> Fix Spicetify
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription>
            {status?.installed ? `Spicetify ${status.version}` : "Spicetify not detected"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void openUrl("https://github.com/SkenSMasteR/GUIFY")}>
            <Bug /> Report an issue
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button variant="ghost" size="sm" onClick={() => void openUrl("https://spicetify.app/docs/cli")}>
            Spicetify CLI docs
          </Button>
        </CardContent>
      </Card>

      <p className="text-muted-foreground pb-2 text-center text-xs">
        By the developers of{" "}
        <button
          className="text-primary underline-offset-2 hover:underline"
          onClick={() => void openUrl("https://github.com/SkenSMasteR/SpoTUI")}
        >
          SpoTUI
        </button>
      </p>
    </div>
  );
}

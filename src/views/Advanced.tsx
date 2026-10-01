import { useEffect, useRef, useState } from "react";
import { CornerDownLeft, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import type { CliLine } from "@/lib/api";

function Lines({ lines }: { lines: CliLine[] }) {
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);
  return (
    <div className="bg-black/30 rounded-lg p-3 font-mono text-xs leading-relaxed">
      {lines.length === 0 && <span className="text-muted-foreground">No output yet.</span>}
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            "whitespace-pre-wrap break-words",
            l.stream === "stderr" && "text-red-400",
            l.stream === "info" && "text-sky-400",
            l.stream === "stdout" && "text-zinc-200",
          )}
        >
          {l.line}
        </div>
      ))}
      <div ref={bottom} />
    </div>
  );
}

export function Advanced() {
  const { status, run, busy, cliLines, runCustom, clearCli } = useApp();
  const [cmd, setCmd] = useState("");

  if (!status || !status.installed) {
    return <div className="text-muted-foreground p-6 text-sm">Spicetify not detected.</div>;
  }

  const submit = () => {
    const text = cmd.trim();
    if (!text) return;
    void runCustom(text);
    setCmd("");
  };

  return (
    <div className="grid gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">Quick commands</span>
        <div className="flex flex-wrap gap-2">
          {["apply", "backup", "restore", "config", "path", "update"].map((c) => (
            <Button key={c} size="sm" variant="outline" onClick={() => void run(c)} disabled={busy === c}>
              {c}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="console">Console</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
              <Row label="Version" value={status.version} />
              <Row label="Backup version" value={status.backupVersion} />
              <Row label="Spicetify path" value={status.spicetifyPath} mono />
              <Row label="Userdata path" value={status.userdataPath} mono />
              <Row label="Spotify path" value={status.spotifyPath} mono />
              <Row label="Color scheme" value={status.colorScheme} />
              <div className="sm:col-span-2">
                <Separator className="my-3" />
                <p className="text-muted-foreground mb-2 text-xs uppercase">Extensions</p>
                <div className="flex flex-wrap gap-1">
                  {status.extensions.length ? (
                    status.extensions.map((e) => <Badge key={e} variant="outline">{e}</Badge>)
                  ) : (
                    <span className="text-muted-foreground text-sm">None</span>
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <p className="text-muted-foreground mb-2 mt-3 text-xs uppercase">Custom apps</p>
                <div className="flex flex-wrap gap-1">
                  {status.customApps.length ? (
                    status.customApps.map((e) => <Badge key={e} variant="outline">{e}</Badge>)
                  ) : (
                    <span className="text-muted-foreground text-sm">None</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(status.config).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell className="font-mono text-xs">{k}</TableCell>
                      <TableCell className="font-mono text-xs">{v}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="console" className="mt-4 grid gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground pl-1 font-mono text-xs">spicetify</span>
            <Input
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="apply"
              className="h-8 font-mono text-xs"
            />
            <Button size="sm" variant="secondary" className="h-8 px-2" onClick={submit}>
              <CornerDownLeft className="size-3.5" />
            </Button>
          </div>
          <ScrollArea className="h-[50vh] rounded-lg border">
            <Lines lines={cliLines} />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="logs" className="mt-4 grid gap-2">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {cliLines.length} lines since launch
            </span>
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={clearCli}>
              <Trash2 /> Clear
            </Button>
          </div>
          <ScrollArea className="h-[55vh] rounded-lg border">
            <Lines lines={cliLines} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-muted-foreground text-xs uppercase">{label}</span>
      <span className={mono ? "break-all font-mono text-xs" : "text-sm"}>{value || "-"}</span>
    </div>
  );
}

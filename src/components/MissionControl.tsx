import { useEffect, useRef, useState } from "react";
import {
  X,
  CornerDownLeft,
  Radio,
  Download,
  Check,
  Trash2,
  ArrowUpCircle,
  Wrench,
  Terminal,
  Palette,
  Eye,
  Info,
  XCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useApp, type Activity } from "@/lib/store";

const DONE_ICON = {
  install: Download,
  apply: Check,
  remove: Trash2,
  update: ArrowUpCircle,
  fix: Wrench,
  theme: Palette,
  watch: Eye,
  run: Terminal,
  info: Info,
} as const;

function ActivityMarker({ a }: { a: Activity }) {
  if (a.state === "running") {
    return (
      <Marker role="status">
        <MarkerIcon>
          <Spinner />
        </MarkerIcon>
        <MarkerContent className="shimmer">{a.text}…</MarkerContent>
      </Marker>
    );
  }
  const Icon = a.state === "error" ? XCircle : DONE_ICON[a.kind];
  return (
    <Marker>
      <MarkerIcon>
        <Icon className={a.state === "error" ? "text-destructive" : "text-foreground"} />
      </MarkerIcon>
      <MarkerContent className={cn(a.state === "error" && "text-destructive")}>
        {a.text}
      </MarkerContent>
    </Marker>
  );
}

export function MissionControl() {
  const { activities, busy, setLogOpen, runCustom } = useApp();
  const [cmd, setCmd] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [activities]);

  const submit = () => {
    const text = cmd.trim();
    if (!text) return;
    void runCustom(text);
    setCmd("");
  };

  return (
    <aside className="flex h-full w-[360px] flex-col border-l">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3">
        <Radio className={cn("size-3.5", busy && "text-primary animate-pulse")} />
        <span className="text-xs font-semibold">Mission Control</span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-6 w-6"
          onClick={() => setLogOpen(false)}
          title="Close"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          {activities.length === 0 ? (
            <Marker>
              <MarkerIcon>
                <Info />
              </MarkerIcon>
              <MarkerContent>Nothing yet.</MarkerContent>
            </Marker>
          ) : (
            activities.map((a) => <ActivityMarker key={a.id} a={a} />)
          )}
          <div ref={bottom} />
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t p-2">
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
      </div>
    </aside>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Copy, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  devmodeConsoleClose,
  devmodeConsoleEval,
  devmodeConsoleOpen,
  devmodeConsoleWrite,
  onDevmodeConsoleLine,
  onDevmodeConsoleResult,
} from "@/lib/api";
import { useDevMode } from "./store";

interface Session {
  id: number;
  kind: "local" | "spotify";
  title: string;
  provider?: string;
}

export interface ActionRun {
  name: string;
  commands: string[];
}

const MAX_LINES = 1500;

const ANSI = /\x1b\[([0-9;?]*)([A-Za-z])|\r/g;
const ANSI_COLORS: Record<number, string> = {
  30: "#6b6b6b",
  31: "#cd3131",
  32: "#0dbc79",
  33: "#e5e510",
  34: "#2472cd",
  35: "#bc3fbc",
  36: "#11a8cd",
  37: "#e5e5e5",
  90: "#6b6b6b",
  91: "#cd3131",
  92: "#0dbc79",
  93: "#e5e510",
  94: "#2472cd",
  95: "#bc3fbc",
  96: "#11a8cd",
  97: "#e5e5e5",
};

interface Segment {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
}

// turns ANSI escape codes into styled runs, dropping cursor and erase sequences
function renderAnsi(line: string): (string | Segment)[] | null {
  ANSI.lastIndex = 0;
  if (!ANSI.test(line)) return null;
  const out: (string | Segment)[] = [];
  let color: string | undefined;
  let bold = false;
  let dim = false;
  let underline = false;
  let index = 0;
  const flush = (to: number) => {
    if (to > index) {
      out.push({ text: line.slice(index, to), color, bold, dim, underline });
    }
  };
  ANSI.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ANSI.exec(line))) {
    flush(m.index);
    index = ANSI.lastIndex;
    if (!m[2] || m[2] !== "m") continue;
    const codes = m[1].split(";").map((c) => parseInt(c || "0", 10));
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (code === 0) {
        color = undefined;
        bold = dim = underline = false;
      } else if (code === 1) bold = true;
      else if (code === 2) dim = true;
      else if (code === 4) underline = true;
      else if (code === 38 && codes[i + 1] === 5) {
        color = ANSI_COLORS[21 + (codes[i + 2] ?? 0) % 10] ?? "#e5e5e5";
        i += 2;
      } else if (code === 39) color = undefined;
      else if (ANSI_COLORS[code]) color = ANSI_COLORS[code];
    }
  }
  flush(line.length);
  return out;
}

function AnsiLine({ line }: { line: string }) {
  const rendered = renderAnsi(line);
  if (!rendered) return line;
  return rendered.map((part, i) =>
    typeof part === "string" ? (
      part
    ) : (
      <span
        key={i}
        style={{
          color: part.color,
          fontWeight: part.bold ? 700 : undefined,
          opacity: part.dim ? 0.6 : undefined,
          textDecoration: part.underline ? "underline" : undefined,
        }}
      >
        {part.text}
      </span>
    ),
  );
}

// Spotify sessions never hit the Rust registry, so their ids live far above it
let spotifySeq = 1_000_000_000;

const localChoices = () =>
  /windows/i.test(navigator.userAgent)
    ? [
        { label: "New terminal (cmd)", provider: "cmd" },
        { label: "New PowerShell", provider: "powershell" },
      ]
    : [{ label: "New bash", provider: "bash" }];

export function ConsolePane({
  visible,
  project,
  run,
  onRunDone,
}: {
  visible: boolean;
  project: string;
  run: ActionRun | null;
  onRunDone: () => void;
}) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [lines, setLines] = useState<Record<number, string[]>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [pending, setPending] = useState<Record<number, boolean>>({});
  const [history, setHistory] = useState<Record<number, string[]>>({});
  const [histIndex, setHistIndex] = useState<Record<number, number>>({});
  const draftRef = useRef("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { spotifyConnected } = useDevMode();

  const append = (id: number, text: string) =>
    setLines((prev) => {
      const next = [...(prev[id] ?? []), ...text.split("\n")];
      return { ...prev, [id]: next.slice(-MAX_LINES) };
    });

  useEffect(() => {
    const un1 = onDevmodeConsoleLine(({ id, line }) => append(id, line));
    const un2 = onDevmodeConsoleResult(({ id, ok, result }) => {
      append(id, ok ? result : `Error: ${result}`);
      setPending((prev) => ({ ...prev, [id]: false }));
    });
    return () => {
      un1.then((f) => f());
      un2.then((f) => f());
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines, activeId, visible]);

  const newLocal = async (provider: string) => {
    try {
      const id = await devmodeConsoleOpen(provider, project);
      setSessions((prev) => {
        const count = prev.filter((s) => s.title.startsWith(provider)).length + 1;
        return [...prev, { id, kind: "local", title: `${provider} ${count}`, provider }];
      });
      setActiveId(id);
    } catch (e) {
      toast.error(String(e));
    }
  };

  // A run from the actions menu opens its own shell and feeds it the commands
  useEffect(() => {
    if (!run) return;
    void (async () => {
      try {
        const provider = localChoices()[0].provider;
        const id = await devmodeConsoleOpen(provider, project);
        setSessions((prev) => [...prev, { id, kind: "local", title: run.name, provider }]);
        setActiveId(id);
        for (const command of run.commands) {
          append(id, `> ${command}`);
          await devmodeConsoleWrite(id, command);
        }
      } catch (e) {
        toast.error(String(e));
      }
      onRunDone();
    })();
  }, [run]);

  const newSpotify = () => {
    const id = ++spotifySeq;
    setSessions((prev) => {
      const count = prev.filter((s) => s.kind === "spotify").length + 1;
      return [...prev, { id, kind: "spotify", title: `Spotify ${count}` }];
    });
    setActiveId(id);
    append(id, "Commands run inside Spotify through the betterdevmode bridge.");
  };

  const closeSession = (id: number) => {
    const session = sessions.find((s) => s.id === id);
    if (session?.kind === "local") void devmodeConsoleClose(id).catch(() => {});
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      setActiveId((a) => (a === id ? (next[next.length - 1]?.id ?? null) : a));
      return next;
    });
    setLines((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const interrupt = async (session: Session) => {
    if (session.kind !== "local" || !session.provider) return;
    const oldId = session.id;
    append(oldId, "^C");
    try {
      await devmodeConsoleClose(oldId);
      const newId = await devmodeConsoleOpen(session.provider, project);
      setLines((prev) => {
        const next = { ...prev };
        next[newId] = next[oldId] ?? [];
        delete next[oldId];
        return next;
      });
      setSessions((prev) => prev.map((s) => (s.id === oldId ? { ...s, id: newId } : s)));
      setActiveId((a) => (a === oldId ? newId : a));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const runLine = () => {
    const session = sessions.find((s) => s.id === activeId);
    if (!session) return;
    const raw = inputs[session.id] ?? "";
    if (!raw.trim()) return;
    setInputs((prev) => ({ ...prev, [session.id]: "" }));
    setHistory((prev) => ({ ...prev, [session.id]: [...(prev[session.id] ?? []), raw] }));
    setHistIndex((prev) => ({ ...prev, [session.id]: -1 }));
    if (session.kind === "local" && /^(clear|cls)$/i.test(raw.trim())) {
      setLines((prev) => ({ ...prev, [session.id]: [] }));
      return;
    }
    append(session.id, `> ${raw}`);
    if (session.kind === "spotify") {
      if (!spotifyConnected) {
        append(session.id, "Spotify is not connected to DevMode.");
        return;
      }
      setPending((prev) => ({ ...prev, [session.id]: true }));
      devmodeConsoleEval(session.id, raw).catch((e) => {
        append(session.id, String(e));
        setPending((prev) => ({ ...prev, [session.id]: false }));
      });
    } else {
      devmodeConsoleWrite(session.id, raw).catch((e) => append(session.id, String(e)));
    }
  };

  const navigateHistory = (dir: "up" | "down") => {
    const session = sessions.find((s) => s.id === activeId);
    if (!session) return;
    const items = history[session.id] ?? [];
    if (items.length === 0) return;
    const current = histIndex[session.id] ?? -1;
    if (dir === "up") {
      const index = current === -1 ? items.length - 1 : Math.max(0, current - 1);
      if (current === -1) draftRef.current = inputs[session.id] ?? "";
      setHistIndex((prev) => ({ ...prev, [session.id]: index }));
      setInputs((prev) => ({ ...prev, [session.id]: items[index] }));
    } else {
      if (current === -1) return;
      const index = current + 1;
      if (index >= items.length) {
        setHistIndex((prev) => ({ ...prev, [session.id]: -1 }));
        setInputs((prev) => ({ ...prev, [session.id]: draftRef.current }));
      } else {
        setHistIndex((prev) => ({ ...prev, [session.id]: index }));
        setInputs((prev) => ({ ...prev, [session.id]: items[index] }));
      }
    }
  };

  const copyActive = async () => {
    if (activeId === null) return;
    try {
      await navigator.clipboard.writeText((lines[activeId] ?? []).join("\n"));
      toast.success("Console output copied");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const active = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <div className="bg-muted/10 flex h-full min-h-0 flex-col">
      <div className="bg-muted/20 border-border flex shrink-0 items-center border-b overflow-x-auto">
        {sessions.map((s) => (
          <div
            key={s.id}
            onClick={() => setActiveId(s.id)}
            className={cn(
              "group flex shrink-0 cursor-pointer items-center gap-1.5 border-r px-2.5 py-1 text-xs",
              activeId === s.id
                ? "bg-background border-border text-foreground"
                : "border-transparent text-muted-foreground hover:bg-accent/40",
            )}
          >
            {s.title}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeSession(s.id);
              }}
              className="hover:bg-accent rounded-sm opacity-0 transition-opacity group-hover:opacity-100"
              title={`Close ${s.title}`}
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-6 shrink-0 rounded-none" title="New console">
              <Plus className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {localChoices().map((c) => (
              <DropdownMenuItem key={c.provider} onClick={() => void newLocal(c.provider)}>
                {c.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={newSpotify}>New Spotify console</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto size-6 shrink-0 rounded-none"
          title="Copy console output"
          disabled={active === null}
          onClick={() => void copyActive()}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1 font-mono text-[11px] leading-relaxed">
        {active === null ? (
          <div className="text-muted-foreground flex h-full items-center justify-center">
            Create a console with the plus button
          </div>
        ) : (
          <>
            {(lines[active.id] ?? []).map((l, i) => (
              <div
                key={i}
                className={cn(
                  "break-words whitespace-pre-wrap",
                  l.startsWith(">") && "text-muted-foreground",
                )}
              >
                <AnsiLine line={l} />
              </div>
            ))}
            {pending[active.id] && <Loader2 className="size-3 animate-spin" />}
            <div className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">
                {active.kind === "spotify" ? "spotify>" : "shell>"}
              </span>
              <input
                value={inputs[active.id] ?? ""}
                onChange={(e) => {
                  setInputs((prev) => ({ ...prev, [active.id]: e.target.value }));
                  setHistIndex((prev) => ({ ...prev, [active.id]: -1 }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runLine();
                  } else if (e.key === "ArrowUp" && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    navigateHistory("up");
                  } else if (e.key === "ArrowDown" && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    navigateHistory("down");
                  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
                    e.preventDefault();
                    void interrupt(active);
                  }
                }}
                autoComplete="off"
                spellCheck={false}
                className="text-foreground caret-foreground [caret-shape:underscore] min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 font-mono text-[11px] leading-inherit shadow-none outline-none"
              />
            </div>
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}

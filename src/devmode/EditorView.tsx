import { useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  Loader2,
  X,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { devmodeListFiles, devmodeReadFile, devmodeWriteFile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDevMode } from "./store";

interface TreeNode {
  name: string;
  path: string;
  kind: "dir" | "file";
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", kind: "dir", children: [] };
  for (const p of paths) {
    let cur = root;
    let acc = "";
    const parts = p.split("/");
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      let next = cur.children.find((c) => c.name === part);
      if (!next) {
        next = { name: part, path: acc, kind: isFile ? "file" : "dir", children: [] };
        cur.children.push(next);
      }
      cur = next;
    }
  }
  const sort = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) =>
      a.kind !== b.kind
        ? a.kind === "dir"
          ? -1
          : 1
        : a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    );
    nodes.forEach((n) => sort(n.children));
    return nodes;
  };
  return sort(root.children);
}

function langExtension(path: string) {
  if (path.endsWith(".css")) return css();
  if (path.endsWith(".json")) return json();
  return javascript();
}

function FileIcon({ node }: { node: TreeNode }) {
  if (node.kind === "dir") return <Folder className="size-4 shrink-0" />;
  if (node.path.endsWith(".json")) return <FileJson className="size-4 shrink-0" />;
  if (node.path.endsWith(".css") || node.path.endsWith(".js"))
    return <FileCode className="size-4 shrink-0" />;
  return <FileText className="size-4 shrink-0" />;
}

function TreeRow({
  node,
  depth,
  active,
  dirty,
  expanded,
  onToggle,
  onOpen,
}: {
  node: TreeNode;
  depth: number;
  active: string | null;
  dirty: Set<string>;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onOpen: (path: string) => void;
}) {
  const isOpen = expanded.has(node.path);
  return (
    <>
      <button
        onClick={() => (node.kind === "dir" ? onToggle(node.path) : onOpen(node.path))}
        className={cn(
          "hover:bg-accent/50 flex w-full items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-xs",
          active === node.path && "bg-accent",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {node.kind === "dir" ? (
          isOpen ? (
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="size-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <FileIcon node={node} />
        )}
        <span className="truncate">{node.name}</span>
        {node.kind === "file" && dirty.has(node.path) && (
          <span className="bg-foreground ml-auto size-1.5 shrink-0 rounded-full" />
        )}
      </button>
      {node.kind === "dir" &&
        isOpen &&
        node.children.map((c) => (
          <TreeRow
            key={c.path}
            node={c}
            depth={depth + 1}
            active={active}
            dirty={dirty}
            expanded={expanded}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
    </>
  );
}

export function EditorView() {
  const { activeProject } = useDevMode();
  const project = activeProject?.name ?? "";
  const [files, setFiles] = useState<string[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const saveRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!project) return;
    setFilesLoading(true);
    devmodeListFiles(project)
      .then(setFiles)
      .catch((e) => toast.error(String(e)))
      .finally(() => setFilesLoading(false));
  }, [project]);

  const tree = useMemo(() => buildTree(files), [files]);

  useEffect(() => {
    setExpanded(new Set(files.filter((f) => f.includes("/")).flatMap((f) => {
      const parts = f.split("/");
      return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
    })));
  }, [files]);

  const dirty = useMemo(() => {
    const s = new Set<string>();
    for (const t of tabs) {
      if (contents[t] !== undefined && contents[t] !== saved[t]) s.add(t);
    }
    return s;
  }, [tabs, contents, saved]);

  const openFile = async (path: string) => {
    setActive(path);
    if (!tabs.includes(path)) setTabs((prev) => [...prev, path]);
    if (contents[path] !== undefined) return;
    try {
      const text = await devmodeReadFile(project, path);
      setContents((prev) => ({ ...prev, [path]: text }));
      setSaved((prev) => ({ ...prev, [path]: text }));
    } catch (e) {
      toast.error(String(e));
      setTabs((prev) => prev.filter((t) => t !== path));
      setActive((prev) => (prev === path ? null : prev));
    }
  };

  const closeTab = (path: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t !== path);
      setActive((a) => (a === path ? (next[next.length - 1] ?? null) : a));
      return next;
    });
  };

  const saveActive = async () => {
    if (!active || contents[active] === undefined || !dirty.has(active)) return;
    setSaving(true);
    try {
      await devmodeWriteFile(project, active, contents[active]);
      setSaved((prev) => ({ ...prev, [active]: contents[active] }));
      toast.success(`Saved ${active}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = () => void saveActive();

  const extensions = useMemo(
    () => [
      langExtension(active ?? ""),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              saveRef.current();
              return true;
            },
          },
        ]),
      ),
    ],
    [active],
  );

  if (!project) return null;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="border-border bg-muted/20 flex w-56 shrink-0 flex-col border-r">
        <div className="text-muted-foreground px-3 py-2 text-[11px] font-semibold tracking-wider uppercase">
          {project}
        </div>
        <ScrollArea className="min-h-0 flex-1 px-2 pb-2">
          {filesLoading ? (
            <div className="grid gap-2 p-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-4" />
              ))}
            </div>
          ) : (
            tree.map((node) => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                active={active}
                dirty={dirty}
                expanded={expanded}
                onToggle={(p) =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(p)) next.delete(p);
                    else next.add(p);
                    return next;
                  })
                }
                onOpen={(p) => void openFile(p)}
              />
            ))
          )}
        </ScrollArea>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {tabs.length > 0 && (
          <div className="bg-muted/20 border-border flex shrink-0 items-center border-b overflow-x-auto">
            {tabs.map((t) => (
              <div
                key={t}
                className={cn(
                  "group flex shrink-0 items-center gap-1.5 border-r px-3 py-1.5 text-xs cursor-pointer",
                  active === t
                    ? "bg-background border-border text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/40",
                )}
                onClick={() => setActive(t)}
              >
                {t.split("/").pop()}
                {dirty.has(t) && <span className="bg-foreground size-1.5 rounded-full" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t);
                  }}
                  className="hover:bg-accent rounded-sm opacity-0 transition-opacity group-hover:opacity-100"
                  title={`Close ${t}`}
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
            {saving && <Loader2 className="ml-2 size-3.5 animate-spin" />}
          </div>
        )}

        {active === null ? (
          <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2">
            <ChevronRight className="size-8" />
            <p className="text-sm">Select a file from the tree to start editing</p>
          </div>
        ) : (
          <CodeMirror
            className="min-h-0 flex-1 overflow-hidden text-sm"
            height="100%"
            theme={vscodeDark}
            value={contents[active] ?? ""}
            extensions={extensions}
            onChange={(v) => setContents((prev) => ({ ...prev, [active]: v }))}
            basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
          />
        )}

        <footer className="border-border bg-muted/20 text-muted-foreground flex h-7 shrink-0 items-center gap-4 border-t px-3 text-[11px]">
          <span>{active ?? ""}</span>
          {active !== null && dirty.has(active) && <span className="ml-auto">Unsaved - Ctrl+S to save</span>}
        </footer>
      </div>
    </div>
  );
}

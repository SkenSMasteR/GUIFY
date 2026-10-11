import { useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentType, type DragEvent } from "react";
import CodeMirror from "@uiw/react-codemirror";
import type { CompletionContext } from "@codemirror/autocomplete";
import { css } from "@codemirror/lang-css";
import { javascript, javascriptLanguage } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import {
  SearchQuery,
  findNext,
  findPrevious,
  replaceAll,
  replaceNext,
  search,
  setSearchQuery,
} from "@codemirror/search";
import { Prec } from "@codemirror/state";
import { EditorView as CodeMirrorHandle, keymap } from "@codemirror/view";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import {
  SiCss,
  SiDocker,
  SiGit,
  SiGraphql,
  SiHtml5,
  SiJavascript,
  SiKotlin,
  SiLatex,
  SiLua,
  SiMarkdown,
  SiMysql,
  SiOpenjdk,
  SiPerl,
  SiPhp,
  SiPython,
  SiReact,
  SiRust,
  SiSass,
  SiSharp,
  SiSvelte,
  SiToml,
  SiTypescript,
  SiVuedotjs,
  SiXml,
  SiYaml,
  SiGnubash,
  SiJupyter,
  SiRuby,
} from "react-icons/si";
import { toast } from "sonner";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  FileImage,
  FileJson,
  FilePlus,
  FilePlus2,
  FileSliders,
  FileTerminal,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  PanelBottom,
  Pencil,
  Play,
  Plus,
  RadioTower,
  Scale,
  Settings2,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  devmodeCreatePath,
  devmodeDeletePath,
  devmodeListFiles,
  devmodeProjectPath,
  devmodeReadFile,
  devmodeRenamePath,
  devmodeRevealProject,
  devmodeSend,
  devmodeListActions,
  devmodeWriteFile,
  type DevmodeAction,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { ConsolePane } from "./ConsolePane";
import { useDevMode, type ProjectMeta } from "./store";
import { ProjectDialog } from "./ProjectsView";

interface TreeNode {
  name: string;
  path: string;
  kind: "dir" | "file";
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", kind: "dir", children: [] };
  for (const entry of paths) {
    const isDirEntry = entry.endsWith("/");
    const p = isDirEntry ? entry.slice(0, -1) : entry;
    let cur = root;
    let acc = "";
    const parts = p.split("/");
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      const isFile = !isDirEntry && i === parts.length - 1;
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

const parentDir = (path: string) => {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
};

const joinPath = (dir: string, name: string) => (dir ? `${dir}/${name}` : name);

const nameOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);

const isProtected = (path: string) => path === "metadata.json";

function langExtension(path: string) {
  if (path.endsWith(".css")) return css();
  if (path.endsWith(".json")) return json();
  return javascript();
}

const JS_COMPLETIONS = [
  { label: "console.log", detail: "method", type: "function", info: "Print to the developer console" },
  { label: "console.warn", detail: "method", type: "function" },
  { label: "console.error", detail: "method", type: "function" },
  { label: "console.info", detail: "method", type: "function" },
  { label: "console.debug", detail: "method", type: "function" },
  { label: "console.table", detail: "method", type: "function" },
  { label: "console.clear", detail: "method", type: "function" },
  { label: "console.time", detail: "method", type: "function" },
  { label: "console.timeEnd", detail: "method", type: "function" },
  { label: "document.querySelector", detail: "method", type: "function" },
  { label: "document.querySelectorAll", detail: "method", type: "function" },
  { label: "document.createElement", detail: "method", type: "function" },
  { label: "document.addEventListener", detail: "method", type: "function" },
  { label: "document.body", detail: "property", type: "variable" },
  { label: "document.head", detail: "property", type: "variable" },
  { label: "window.addEventListener", detail: "method", type: "function" },
  { label: "window.location.reload", detail: "method", type: "function" },
  { label: "localStorage.getItem", detail: "method", type: "function" },
  { label: "localStorage.setItem", detail: "method", type: "function" },
  { label: "localStorage.removeItem", detail: "method", type: "function" },
  { label: "sessionStorage.getItem", detail: "method", type: "function" },
  { label: "sessionStorage.setItem", detail: "method", type: "function" },
  { label: "setTimeout", detail: "function", type: "function" },
  { label: "setInterval", detail: "function", type: "function" },
  { label: "clearTimeout", detail: "function", type: "function" },
  { label: "clearInterval", detail: "function", type: "function" },
  { label: "fetch", detail: "function", type: "function" },
  { label: "JSON.parse", detail: "method", type: "function" },
  { label: "JSON.stringify", detail: "method", type: "function" },
  { label: "Object.keys", detail: "method", type: "function" },
  { label: "Object.values", detail: "method", type: "function" },
  { label: "Object.entries", detail: "method", type: "function" },
  { label: "Object.assign", detail: "method", type: "function" },
  { label: "Array.from", detail: "method", type: "function" },
  { label: "Promise", detail: "class", type: "class" },
  { label: "Spicetify.Player", detail: "Spicetify", type: "variable", info: "Playback control, events, metadata" },
  { label: "Spicetify.Platform", detail: "Spicetify", type: "variable", info: "Internal Spotify platform APIs" },
  { label: "Spicetify.CosmosAsync", detail: "Spicetify", type: "variable", info: "Send requests to Spotify backends" },
  { label: "Spicetify.React", detail: "Spicetify", type: "variable" },
  { label: "Spicetify.ReactDOM", detail: "Spicetify", type: "variable" },
  { label: "Spicetify.Templater", detail: "Spicetify", type: "variable" },
  { label: "Spicetify.DOM", detail: "Spicetify", type: "variable" },
  { label: "Spicetify.Config", detail: "Spicetify", type: "variable" },
  { label: "Spicetify.metadataConfig", detail: "Spicetify", type: "variable" },
  { label: "Spicetify.getKeybindings", detail: "method", type: "function" },
  { label: "Spicetify.URI", detail: "Spicetify", type: "class" },
  { label: "Spicetify.Clipboard", detail: "Spicetify", type: "variable" },
  { label: "Spicetify.ExperimentProvider", detail: "Spicetify", type: "variable" },
  { label: "Spicetify.TypeProvider", detail: "Spicetify", type: "variable" },
].map((o) => ({ ...o, boost: 1 }));

function jsCompletion(context: CompletionContext) {
  const token = context.matchBefore(/[\w$.]*/);
  if (!token || (token.from === token.to && !context.explicit)) return null;
  return { options: JS_COMPLETIONS, from: token.from, validFor: /^[\w$.]*$/ };
}

const jsCompletions = javascriptLanguage.data.of({ autocomplete: jsCompletion });

function parseMetaJson(text: string): ProjectMeta | null {
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text);
  } catch {
    return null;
  }
  const entries = o.entries as Record<string, unknown> | undefined;
  if (!o || typeof o.name !== "string" || !o.name || typeof entries?.js !== "string" || typeof entries?.css !== "string") {
    return null;
  }
  const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
  const deps: Record<string, string> = {};
  if (o.dependencies && typeof o.dependencies === "object") {
    for (const [k, v] of Object.entries(o.dependencies as Record<string, unknown>)) deps[k] = String(v);
  }
  return {
    name: o.name,
    tags: list(o.tags),
    version: str(o.version, "0.0.0") || "0.0.0",
    authors: list(o.authors),
    description: str(o.description, ""),
    entries: { js: entries.js, css: entries.css },
    hasMixins: !!o.hasMixins,
    dependencies: deps,
    preview: str(o.preview, ""),
  };
}

type FileGlyph = {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  color?: string;
};

const BRAND_ICONS: Record<string, FileGlyph> = {
  js: { icon: SiJavascript, color: "#e8d44d" },
  mjs: { icon: SiJavascript, color: "#e8d44d" },
  cjs: { icon: SiJavascript, color: "#e8d44d" },
  jsx: { icon: SiReact, color: "#61dafb" },
  ts: { icon: SiTypescript, color: "#4f8cc6" },
  tsx: { icon: SiReact, color: "#61dafb" },
  py: { icon: SiPython, color: "#519aba" },
  css: { icon: SiCss, color: "#8c6fc8" },
  scss: { icon: SiSass, color: "#c6538c" },
  sass: { icon: SiSass, color: "#c6538c" },
  html: { icon: SiHtml5, color: "#e34f26" },
  yml: { icon: SiYaml, color: "#d0424a" },
  yaml: { icon: SiYaml, color: "#d0424a" },
  md: { icon: SiMarkdown, color: "#a08055" },
  sh: { icon: SiGnubash, color: "#4eaa25" },
  bat: { icon: FileTerminal, color: "#b4b4b4" },
  cmd: { icon: FileTerminal, color: "#b4b4b4" },
  ps1: { icon: FileTerminal, color: "#5aa0d8" },
  ini: { icon: FileSliders, color: "#8fa8c0" },
  toml: { icon: SiToml, color: "#a3582f" },
  xml: { icon: SiXml, color: "#5aa7d6" },
  rs: { icon: SiRust, color: "#dea520" },
  rb: { icon: SiRuby, color: "#cc342d" },
  php: { icon: SiPhp, color: "#8288c2" },
  cs: { icon: SiSharp, color: "#9560b8" },
  kt: { icon: SiKotlin, color: "#7f52ff" },
  java: { icon: SiOpenjdk, color: "#d8672f" },
  lua: { icon: SiLua, color: "#5a68d8" },
  pl: { icon: SiPerl, color: "#6b78b3" },
  ipynb: { icon: SiJupyter, color: "#f37625" },
  tex: { icon: SiLatex, color: "#4fb34f" },
  sql: { icon: SiMysql, color: "#4479a1" },
  graphql: { icon: SiGraphql, color: "#e10098" },
  gql: { icon: SiGraphql, color: "#e10098" },
  vue: { icon: SiVuedotjs, color: "#42b883" },
  svelte: { icon: SiSvelte, color: "#ff3e00" },
};

const NAME_ICONS: Record<string, FileGlyph> = {
  dockerfile: { icon: SiDocker, color: "#2496ed" },
  ".gitignore": { icon: SiGit, color: "#f05032" },
  ".gitattributes": { icon: SiGit, color: "#f05032" },
  ".gitmodules": { icon: SiGit, color: "#f05032" },
  license: { icon: Scale, color: "#d8b45a" },
  licence: { icon: Scale, color: "#d8b45a" },
  copying: { icon: Scale, color: "#d8b45a" },
};

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "ico", "svg", "avif", "bmp"]);

function FileIcon({ node }: { node: TreeNode }) {
  if (node.kind === "dir") return <Folder className="size-4 shrink-0" />;
  const lower = node.name.toLowerCase();
  const glyph =
    NAME_ICONS[lower] ?? BRAND_ICONS[lower.includes(".") ? lower.split(".").pop()! : ""];
  if (glyph) {
    const Icon = glyph.icon;
    return <Icon className="size-3.5 shrink-0" style={{ color: glyph.color }} />;
  }
  if (lower.endsWith(".json")) return <FileJson className="size-4 shrink-0" />;
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  if (IMAGE_EXTS.has(ext)) return <FileImage className="size-4 shrink-0" />;
  return <FileText className="size-4 shrink-0" />;
}

interface PromptState {
  title: string;
  label: string;
  value: string;
  run: (name: string) => Promise<void>;
}

function TreeRow({
  node,
  active,
  dirty,
  expanded,
  dragging,
  dropTarget,
  onToggle,
  onOpen,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onDragStartNode,
  onDragEndNode,
  onDragOverNode,
  onDropNode,
}: {
  node: TreeNode;
  active: string | null;
  dirty: Set<string>;
  expanded: Set<string>;
  dragging: string | null;
  dropTarget: string | null;
  onToggle: (path: string) => void;
  onOpen: (path: string) => void;
  onNewFile: (dir: string) => void;
  onNewFolder: (dir: string) => void;
  onRename: (node: TreeNode) => void;
  onDelete: (node: TreeNode) => void;
  onDragStartNode: (node: TreeNode) => void;
  onDragEndNode: () => void;
  onDragOverNode: (e: DragEvent, node: TreeNode) => void;
  onDropNode: (e: DragEvent, node: TreeNode) => void;
}) {
  const isOpen = expanded.has(node.path);
  const isDir = node.kind === "dir";
  const isDropTarget = isDir && dropTarget === node.path;
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            onClick={() => (isDir ? onToggle(node.path) : onOpen(node.path))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (isDir) onToggle(node.path);
                else onOpen(node.path);
              }
            }}
            draggable={!isProtected(node.path)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", node.path);
              onDragStartNode(node);
            }}
            onDragEnd={onDragEndNode}
            onDragOver={(e) => onDragOverNode(e, node)}
            onDrop={(e) => onDropNode(e, node)}
            className={cn(
              "hover:bg-accent/50 flex w-full cursor-default items-center gap-1.5 rounded-sm px-1 py-0.5 text-left text-xs",
              active === node.path && "bg-accent",
              isDropTarget && "bg-accent ring-1 ring-ring",
              dragging === node.path && "opacity-50",
            )}
          >
            {isDir ? (
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
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {!isDir && <ContextMenuItem onClick={() => onOpen(node.path)}>Open</ContextMenuItem>}
          {isDir && (
            <>
              <ContextMenuItem onClick={() => onNewFile(node.path)}>
                <FilePlus /> New file
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onNewFolder(node.path)}>
                <FolderPlus /> New folder
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem disabled={isProtected(node.path)} onClick={() => onRename(node)}>
            <Pencil /> Rename
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            disabled={isProtected(node.path)}
            onClick={() => onDelete(node)}
          >
            <Trash2 /> Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {isDir && isOpen && (
        <div className="border-border ml-[10px] border-l pl-[6px]">
          {node.children.map((c) => (
            <TreeRow
              key={c.path}
              node={c}
              active={active}
              dirty={dirty}
              expanded={expanded}
              dragging={dragging}
              dropTarget={dropTarget}
              onToggle={onToggle}
              onOpen={onOpen}
              onNewFile={onNewFile}
              onNewFolder={onNewFolder}
              onRename={onRename}
              onDelete={onDelete}
              onDragStartNode={onDragStartNode}
              onDragEndNode={onDragEndNode}
              onDragOverNode={onDragOverNode}
              onDropNode={onDropNode}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function EditorView() {
  const {
    activeProject,
    spotifyConnected,
    installBridge,
    deleteProject,
    backToProjects,
    editProject,
    syncMeta,
  } = useDevMode();
  const project = activeProject?.name ?? "";
  const [files, setFiles] = useState<string[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [tabs, setTabs] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [contents, setContents] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<{ path: string; kind: "file" | "dir" } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [pendingFileDelete, setPendingFileDelete] = useState<{ node: TreeNode; tabs: number } | null>(null);
  const [editSettings, setEditSettings] = useState(false);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  const [find, setFind] = useState<{ query: string; replace: string; expanded: boolean } | null>(null);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [actions, setActions] = useState<DevmodeAction[]>([]);
  const [actionRun, setActionRun] = useState<DevmodeAction | null>(null);
  const [consoleHeight, setConsoleHeight] = useState(208);
  const [treeWidth, setTreeWidth] = useState(224);
  const resizeRef = useRef<{ mode: "console" | "tree"; startPos: number; startSize: number } | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = resizeRef.current;
      if (!d) return;
      if (d.mode === "console") {
        setConsoleHeight(Math.min(Math.max(120, d.startSize + (d.startPos - e.clientY)), window.innerHeight - 220));
      } else {
        setTreeWidth(Math.min(Math.max(160, d.startSize + (e.clientX - d.startPos)), 480));
      }
    };
    const onUp = () => {
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);
  const cmRef = useRef<CodeMirrorHandle | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);

  const findOpen = find !== null;

  useEffect(() => {
    if (findOpen) findInputRef.current?.focus();
  }, [findOpen]);

  useEffect(() => {
    const view = cmRef.current;
    if (!view) return;
    view.dispatch(
      view.state.update({
        effects: setSearchQuery.of(new SearchQuery({ search: find?.query ?? "", replace: find?.replace ?? "" })),
      }),
    );
  }, [find?.query, find?.replace]);

  const isWindows = /windows/i.test(navigator.userAgent);

  const saveRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!project) return;
    setFilesLoading(true);
    setTabs([]);
    setActive(null);
    setContents({});
    setSaved({});
    setExpanded(new Set());
    cmRef.current = null;
    devmodeListFiles(project)
      .then(setFiles)
      .catch((e) => toast.error(String(e)))
      .finally(() => setFilesLoading(false));
  }, [project]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();
        const view = cmRef.current;
        if (!view) return;
        const sel = view.state.selection.main;
        const preset = sel.empty ? "" : view.state.sliceDoc(sel.from, sel.to).slice(0, 256);
        setFind({ query: preset, replace: "", expanded: false });
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const tree = useMemo(() => buildTree(files), [files]);

  const refreshFiles = () => devmodeListFiles(project).then(setFiles).catch((e) => toast.error(String(e)));

  const loadActions = () =>
    devmodeListActions(project).then(setActions).catch((e) => toast.error(String(e)));

  const runAction = (action: DevmodeAction) => {
    setConsoleOpen(true);
    setActionRun(action);
  };

  const dirty = useMemo(() => {
    const s = new Set<string>();
    for (const t of tabs) {
      if (contents[t] !== undefined && contents[t] !== saved[t]) s.add(t);
    }
    return s;
  }, [tabs, contents, saved]);

  const openFile = async (path: string) => {
    setActive(path);
    setTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
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
      const text = contents[active];
      await devmodeWriteFile(project, active, text);
      setSaved((prev) => ({ ...prev, [active]: text }));
      toast.success(`Saved ${active}`);
      if (active === "metadata.json") {
        const parsed = parseMetaJson(text);
        if (parsed) {
          if (parsed.name !== project) await editProject(project, parsed);
          else syncMeta(parsed);
        } else {
          toast.error("metadata.json does not match the project schema");
        }
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = () => void saveActive();

  const applyToSpotify = async () => {
    if (!activeProject) return;
    const { js, css } = activeProject.entries;
    setApplying(true);
    try {
      const readEntry = async (name: string) => {
        if (!name) return "";
        if (contents[name] !== undefined) return contents[name];
        try {
          return await devmodeReadFile(project, name);
        } catch {
          return "";
        }
      };
      const cssText = await readEntry(css);
      const jsText = await readEntry(js);
      if (!cssText.trim() && !jsText.trim()) {
        await devmodeSend(JSON.stringify({ type: "clear" }));
        toast.success("Cleared everything applied in Spotify");
        return;
      }
      await devmodeSend(JSON.stringify({ type: "apply_all", css: cssText, js: jsText }));
      toast.success("Sent to Spotify. Page reload incoming.");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setApplying(false);
    }
  };

  const runPrompt = async (name: string) => {
    if (!prompt) return;
    const fn = prompt.run;
    setPrompt(null);
    await fn(name);
  };

  const newFile = (dir: string) =>
    setPrompt({
      title: "New file",
      label: "File name",
      value: "",
      run: async (name) => {
        const clean = name.trim();
        if (!clean) return;
        try {
          await devmodeCreatePath(project, joinPath(dir, clean), false);
          await refreshFiles();
          void openFile(joinPath(dir, clean));
        } catch (e) {
          toast.error(String(e));
        }
      },
    });

  const newFolder = (dir: string) =>
    setPrompt({
      title: "New folder",
      label: "Folder name",
      value: "",
      run: async (name) => {
        const clean = name.trim();
        if (!clean) return;
        try {
          await devmodeCreatePath(project, joinPath(dir, clean), true);
          await refreshFiles();
        } catch (e) {
          toast.error(String(e));
        }
      },
    });

  const remapOpenState = (from: string, to: string, isDir: boolean) => {
    const under = isDir
      ? (p: string) => p === from || p.startsWith(`${from}/`)
      : (p: string) => p === from;
    const remap = (p: string) => (under(p) ? to + p.slice(from.length) : p);
    setTabs((prev) => prev.map(remap));
    setActive((prev) => (prev ? remap(prev) : prev));
    setContents((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [remap(k), v])));
    setSaved((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [remap(k), v])));
  };

  const validMove = (targetDir: string) => {
    if (!drag) return false;
    if (drag.kind === "dir" && (targetDir === drag.path || targetDir.startsWith(`${drag.path}/`)))
      return false;
    return parentDir(drag.path) !== targetDir;
  };

  const moveTo = async (targetDir: string) => {
    if (!drag || !validMove(targetDir)) return;
    const from = drag.path;
    const isDir = drag.kind === "dir";
    const to = joinPath(targetDir, nameOf(from));
    setDrag(null);
    setDropTarget(null);
    try {
      await devmodeRenamePath(project, from, to);
      remapOpenState(from, to, isDir);
      await refreshFiles();
      toast.success(`Moved ${nameOf(from)} to ${targetDir || "project root"}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const dirForNode = (node: TreeNode) => (node.kind === "dir" ? node.path : parentDir(node.path));

  const rowDragStart = (node: TreeNode) => setDrag({ path: node.path, kind: node.kind });

  const rowDragEnd = () => {
    setDrag(null);
    setDropTarget(null);
  };

  const rowDragOver = (e: DragEvent, node: TreeNode) => {
    e.stopPropagation();
    const targetDir = dirForNode(node);
    if (!validMove(targetDir)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(targetDir);
  };

  const rowDrop = (e: DragEvent, node: TreeNode) => {
    e.stopPropagation();
    if (!validMove(dirForNode(node))) return;
    e.preventDefault();
    void moveTo(dirForNode(node));
  };

  const rootDragOver = (e: DragEvent) => {
    if (!validMove("")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget("");
  };

  const rootDrop = (e: DragEvent) => {
    if (!validMove("")) return;
    e.preventDefault();
    void moveTo("");
  };

  const renameNode = (node: TreeNode) =>
    setPrompt({
      title: `Rename ${node.name}`,
      label: "New name",
      value: node.name,
      run: async (name) => {
        const clean = name.trim();
        if (!clean || clean === node.name) return;
        const to = joinPath(parentDir(node.path), clean);
        try {
          await devmodeRenamePath(project, node.path, to);
          remapOpenState(node.path, to, node.kind === "dir");
          await refreshFiles();
        } catch (e) {
          toast.error(String(e));
        }
      },
    });

  const performFileDelete = async (node: TreeNode) => {
    const under =
      node.kind === "dir"
        ? (p: string) => p === node.path || p.startsWith(`${node.path}/`)
        : (p: string) => p === node.path;
    try {
      await devmodeDeletePath(project, node.path);
      setTabs((prev) => {
        const next = prev.filter((t) => !under(t));
        setActive((a) => (a && under(a) ? (next[next.length - 1] ?? null) : a));
        return next;
      });
      await refreshFiles();
      toast.success(`Deleted ${node.name}`);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const deleteNode = (node: TreeNode) => {
    const under =
      node.kind === "dir"
        ? (p: string) => p === node.path || p.startsWith(`${node.path}/`)
        : (p: string) => p === node.path;
    const affected = tabs.filter(under).length;
    if (affected > 0) {
      setPendingFileDelete({ node, tabs: affected });
      return;
    }
    void performFileDelete(node);
  };

  const copyProjectPath = async () => {
    try {
      const path = await devmodeProjectPath(project);
      await navigator.clipboard.writeText(path);
      toast.success("Project path copied");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const revealProjectFolder = async () => {
    try {
      await devmodeRevealProject(project);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const removeProject = async () => {
    setConfirmProjectDelete(false);
    await deleteProject(project);
    backToProjects();
  };

  const runFind = (dir: "next" | "prev") => {
    const view = cmRef.current;
    if (!view) return;
    if (dir === "next") findNext(view);
    else findPrevious(view);
  };

  const doReplace = () => {
    if (cmRef.current) replaceNext(cmRef.current);
  };

  const doReplaceAll = () => {
    if (cmRef.current) replaceAll(cmRef.current);
  };

  const extensions = useMemo(() => {
    const isJs = (active ?? "").endsWith(".js");
    return [
      langExtension(active ?? ""),
      ...(isJs ? [jsCompletions] : []),
      search(),
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
    ];
  }, [active]);

  if (!project) return null;

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className={cn(
          "border-border bg-muted/20 flex shrink-0 flex-col",
          drag && dropTarget === "" && "bg-accent/30",
        )}
        style={{ width: treeWidth }}
        onDragOver={rootDragOver}
        onDrop={rootDrop}
      >
        <div className="border-border flex items-center gap-1 border-b px-2 py-1.5">
          <span className="text-muted-foreground truncate flex-1 text-[11px] font-semibold tracking-wider uppercase">
            {project}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="size-6" title="New file" onClick={() => newFile("")}>
                <FilePlus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New file</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" className="size-6" title="New folder" onClick={() => newFolder("")}>
                <FolderPlus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New folder</TooltipContent>
          </Tooltip>
        </div>
        <ScrollArea className="min-h-0 flex-1 px-2 py-2">
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
                active={active}
                dirty={dirty}
                expanded={expanded}
                dragging={drag?.path ?? null}
                dropTarget={dropTarget}
                onToggle={(p) =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(p)) next.delete(p);
                    else next.add(p);
                    return next;
                  })
                }
                onOpen={(p) => void openFile(p)}
                onNewFile={newFile}
                onNewFolder={newFolder}
                onRename={renameNode}
                onDelete={deleteNode}
                onDragStartNode={rowDragStart}
                onDragEndNode={rowDragEnd}
                onDragOverNode={rowDragOver}
                onDropNode={rowDrop}
              />
            ))
          )}
        </ScrollArea>
        <div className="border-border bg-muted/10 border-t p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="group w-full justify-start">
                <Settings2 />
                Project settings
                <ChevronDown className="ml-auto size-3.5 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem onClick={() => setEditSettings(true)}>
                <Pencil /> Edit settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void copyProjectPath()}>
                <Copy /> Copy folder path
              </DropdownMenuItem>
              {isWindows && (
                <DropdownMenuItem onClick={() => void revealProjectFolder()}>
                  <FolderOpen /> Reveal in Explorer
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmProjectDelete(true)}>
                <Trash2 /> Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      <div
        className="bg-border hover:bg-accent/60 w-1 shrink-0 cursor-col-resize"
        onMouseDown={(e) => {
          resizeRef.current = { mode: "tree", startPos: e.clientX, startSize: treeWidth };
        }}
      />

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
                {nameOf(t)}
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

        <div className="relative flex min-h-0 flex-1 flex-col">
          {active === null ? (
            <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2">
              <FilePlus2 className="size-8" />
              <p className="text-sm">Select a file from the tree to start editing</p>
            </div>
          ) : (
            <CodeMirror
              className="min-h-0 flex-1 overflow-hidden text-sm"
              height="100%"
              theme={vscodeDark}
              value={contents[active] ?? ""}
              extensions={extensions}
              onCreateEditor={(view) => {
                cmRef.current = view;
              }}
              onChange={(v) => setContents((prev) => ({ ...prev, [active]: v }))}
              basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
            />
          )}
          {find && (
            <div className="absolute top-2 right-2 z-10 flex flex-col items-end gap-1">
              <div className="bg-popover text-popover-foreground border-border flex items-center gap-0.5 rounded-lg border p-1 shadow-lg">
                <Input
                  ref={findInputRef}
                  value={find.query}
                  onChange={(e) => setFind({ ...find, query: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runFind(e.shiftKey ? "prev" : "next");
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setFind(null);
                    }
                  }}
                  placeholder="Find"
                  autoComplete="off"
                  className="bg-background border-input h-7 w-56 text-xs"
                />
                <Button size="icon" variant="ghost" className="size-6" title="Previous match" onClick={() => runFind("prev")}>
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="size-6" title="Next match" onClick={() => runFind("next")}>
                  <ChevronDown className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6"
                  title={find.expanded ? "Hide replace" : "Show replace"}
                  onClick={() => setFind({ ...find, expanded: !find.expanded })}
                >
                  <ChevronRight className={cn("size-3.5 transition-transform", find.expanded && "rotate-90")} />
                </Button>
                <Button size="icon" variant="ghost" className="size-6" title="Close" onClick={() => setFind(null)}>
                  <X className="size-3.5" />
                </Button>
              </div>
              {find.expanded && (
                <div className="bg-popover text-popover-foreground border-border flex items-center gap-1 rounded-lg border p-1 shadow-lg">
                  <Input
                    value={find.replace}
                    onChange={(e) => setFind({ ...find, replace: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        doReplace();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setFind(null);
                      }
                    }}
                    placeholder="Replace"
                    autoComplete="off"
                    className="bg-background border-input h-7 w-56 text-xs"
                  />
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={doReplace}>
                    Replace
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={doReplaceAll}>
                    Replace all
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {consoleOpen && (
          <div
            className="bg-border hover:bg-accent/60 h-1 shrink-0 cursor-row-resize"
            onMouseDown={(e) => {
              resizeRef.current = { mode: "console", startPos: e.clientY, startSize: consoleHeight };
            }}
          />
        )}
        <div
          className={cn("shrink-0 overflow-hidden", !consoleOpen && "hidden")}
          style={{ height: consoleOpen ? consoleHeight : undefined }}
        >
          <ConsolePane
            visible={consoleOpen}
            project={project}
            run={actionRun}
            onRunDone={() => setActionRun(null)}
          />
        </div>

        <footer className="border-border bg-muted/20 text-muted-foreground flex h-8 shrink-0 items-center gap-4 border-t px-3 text-[11px]">
          <span className="truncate">{active ?? ""}</span>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu onOpenChange={(o) => o && void loadActions()}>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="size-6" title="Run project action">
                  <Bot className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {actions.length === 0 ? (
                  <DropdownMenuItem disabled>No actions defined</DropdownMenuItem>
                ) : (
                  <>
                    {actions.map((a) => (
                      <DropdownMenuItem key={a.name} onClick={() => runAction(a)}>
                        <Play /> {a.name}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void openFile(".guify/actions.yaml")}>
                      <Pencil /> Edit actions.yaml
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              title={consoleOpen ? "Hide console" : "Show console"}
              onClick={() => setConsoleOpen((v) => !v)}
            >
              <PanelBottom className="size-3.5" />
            </Button>
            <Button
              size="sm"
              variant="default"
              className="h-6 gap-1 px-2 text-[11px]"
              disabled={!spotifyConnected || applying}
              onClick={() => void applyToSpotify()}
            >
              {applying ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
              Apply
            </Button>
            <span
              className={cn(
                "flex items-center gap-1.5",
                spotifyConnected ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <RadioTower className={cn("size-3.5", spotifyConnected && "text-emerald-500")} />
              {spotifyConnected ? "Spotify linked" : "Spotify offline"}
            </span>
            {!spotifyConnected && (
              <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" onClick={() => void installBridge()}>
                <Download className="size-3.5" /> Install bridge
              </Button>
            )}
            {active !== null && dirty.has(active) && <span className="ml-1">Unsaved</span>}
          </div>
        </footer>
      </div>

      <Dialog open={prompt !== null} onOpenChange={(v) => !v && setPrompt(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{prompt?.title}</DialogTitle>
          </DialogHeader>
          {prompt && (
            <div className="grid gap-2">
              <Label htmlFor="dm-prompt">{prompt.label}</Label>
              <Input
                id="dm-prompt"
                autoFocus
                autoComplete="off"
                value={prompt.value}
                onChange={(e) => setPrompt({ ...prompt, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runPrompt(prompt.value);
                }}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrompt(null)}>
              Cancel
            </Button>
            <Button onClick={() => prompt && void runPrompt(prompt.value)}>
              <Plus /> OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingFileDelete !== null} onOpenChange={(v) => !v && setPendingFileDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingFileDelete?.node.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingFileDelete
                ? `${pendingFileDelete.tabs} open tab${pendingFileDelete.tabs > 1 ? "s are" : " is"} discarded and unsaved changes are lost.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingFileDelete) void performFileDelete(pendingFileDelete.node);
                setPendingFileDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmProjectDelete} onOpenChange={setConfirmProjectDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project {project}?</AlertDialogTitle>
            <AlertDialogDescription>
              The project folder and every file inside it are removed from disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeProject()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeProject && (
        <ProjectDialog
          open={editSettings}
          onOpenChange={setEditSettings}
          initial={activeProject}
        />
      )}
    </div>
  );
}

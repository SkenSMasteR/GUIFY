import { useEffect, useState } from "react";
import {
  ChevronDown,
  FilePlus2,
  FolderOpen,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Box,
  Trash2,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDevMode, type ProjectMeta } from "./store";
const parseList = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const parseDependencies = (value: string) => {
  const deps: Record<string, string> = {};
  for (const token of parseList(value)) {
    const at = token.lastIndexOf("@");
    if (at > 0) deps[token.slice(0, at)] = token.slice(at + 1);
    else deps[token] = "*";
  }
  return deps;
};

interface Draft {
  name: string;
  version: string;
  tags: string;
  authors: string;
  description: string;
  js: string;
  css: string;
  hasMixins: boolean;
  dependencies: string;
  preview: string;
}

const EMPTY_DRAFT: Draft = {
  name: "",
  version: "1.0.0",
  tags: "",
  authors: "",
  description: "",
  js: "",
  css: "",
  hasMixins: false,
  dependencies: "",
  preview: "",
};

const isExtensionDraft = (draft: Draft) =>
  parseList(draft.tags).some((t) => t.toLowerCase() === "extension");

function draftToMeta(draft: Draft): ProjectMeta {
  const withSuffix = (file: string, suffix: string) =>
    file && !file.endsWith(suffix) ? `${file}${suffix}` : file;
  const extension = isExtensionDraft(draft);
  return {
    name: draft.name.trim(),
    tags: parseList(draft.tags),
    version: draft.version.trim() || "0.0.0",
    authors: parseList(draft.authors),
    description: draft.description.trim(),
    entries: {
      js: withSuffix(draft.js.trim(), ".js"),
      css: extension ? "" : withSuffix(draft.css.trim(), ".css"),
    },
    hasMixins: draft.hasMixins,
    dependencies: parseDependencies(draft.dependencies),
    preview: draft.preview.trim(),
  };
}

function metaToDraft(meta: ProjectMeta): Draft {
  return {
    name: meta.name,
    version: meta.version,
    tags: meta.tags.join(", "),
    authors: meta.authors.join(", "),
    description: meta.description,
    js: meta.entries.js,
    css: meta.entries.css,
    hasMixins: meta.hasMixins,
    dependencies: Object.entries(meta.dependencies)
      .map(([k, v]) => `${k}@${v}`)
      .join(", "),
    preview: meta.preview,
  };
}

export function ProjectDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ProjectMeta | null;
}) {
  const { createProject, editProject, openEditor } = useDevMode();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const isEdit = initial !== null;

  useEffect(() => {
    if (open) setDraft(initial ? metaToDraft(initial) : EMPTY_DRAFT);
  }, [open, initial]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const meta = draftToMeta(draft);
  const extension = isExtensionDraft(draft);
  const valid =
    meta.name.length > 0 && meta.entries.js.length > 0 && (extension || meta.entries.css.length > 0);

  const submit = async () => {
    setBusy(true);
    if (isEdit && initial) {
      const ok = await editProject(initial.name, meta);
      setBusy(false);
      if (ok) onOpenChange(false);
      return;
    }
    const created = await createProject(meta);
    setBusy(false);
    if (created) {
      onOpenChange(false);
      openEditor(meta);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${initial?.name}` : "New project"}</DialogTitle>
        </DialogHeader>
        <div className="dm-scroll grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dm-name">Name</Label>
              <Input
                autoComplete="off"
                id="dm-name"
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="my-theme"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dm-version">Version</Label>
              <Input
                autoComplete="off"
                id="dm-version"
                value={draft.version}
                onChange={(e) => set({ version: e.target.value })}
                placeholder="2.3.3"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dm-description">Description</Label>
            <Textarea
              autoComplete="off"
              id="dm-description"
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="A short description of your project…"
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dm-authors">Authors</Label>
              <Input
                autoComplete="off"
                id="dm-authors"
                value={draft.authors}
                onChange={(e) => set({ authors: e.target.value })}
                placeholder="SkenS, Alice"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dm-tags">Tags</Label>
              <Input
                autoComplete="off"
                id="dm-tags"
                value={draft.tags}
                onChange={(e) => set({ tags: e.target.value })}
                placeholder="theme, extension"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dm-js">JS entry</Label>
              <Input
                autoComplete="off"
                id="dm-js"
                value={draft.js}
                onChange={(e) => set({ js: e.target.value })}
                placeholder="theme.js"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dm-css">CSS entry</Label>
              <Input
                autoComplete="off"
                id="dm-css"
                value={extension ? "" : draft.css}
                onChange={(e) => set({ css: e.target.value })}
                placeholder={extension ? "Extensions have no CSS entry" : "user.css"}
                disabled={extension}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dm-deps">Dependencies</Label>
              <Input
                autoComplete="off"
                id="dm-deps"
                value={draft.dependencies}
                onChange={(e) => set({ dependencies: e.target.value })}
                placeholder="stdlib@^1.2.0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dm-preview">Preview URL</Label>
              <Input
                autoComplete="off"
                id="dm-preview"
                value={draft.preview}
                onChange={(e) => set({ preview: e.target.value })}
                placeholder="https://…/preview.gif"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="dm-mixins"
              checked={draft.hasMixins}
              onCheckedChange={(v) => set({ hasMixins: v })}
            />
            <Label htmlFor="dm-mixins" className="text-muted-foreground text-sm">
              Has mixins
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid || busy} onClick={() => void submit()}>
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewProjectMenu({
  onCreate,
  onClone,
  align = "end",
}: {
  onCreate: () => void;
  onClone: () => void;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus /> New project
          <ChevronDown className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
        <DropdownMenuItem onClick={onCreate}>
          <FilePlus2 /> Create from scratch
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onClone}>
          <GitBranch /> Clone repository
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CloneDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { cloneProject, openEditor } = useDevMode();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const meta = await cloneProject(url.trim());
    setBusy(false);
    if (meta) {
      setUrl("");
      onOpenChange(false);
      openEditor(meta);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clone repository</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="dm-clone-url">Repository URL</Label>
          <Input
            autoComplete="off"
            id="dm-clone-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && url.trim()) void submit();
            }}
            placeholder="https://github.com/user/repo"
          />
          <p className="text-muted-foreground text-xs">
            The repository must contain a metadata.json to be accepted.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!url.trim() || busy} onClick={() => void submit()}>
            {busy && <Loader2 className="animate-spin" />} Clone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsView() {
  const { projects, loading, openEditor, deleteProject } = useDevMode();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectMeta | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProjectMeta | null>(null);

  const startCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const startEdit = (p: ProjectMeta) => {
    setEditing(p);
    setDialogOpen(true);
  };

  return (
    <div className="grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold">
          Projects{" "}
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
            {projects.length}
          </span>
        </h2>
        <div className="ml-auto">
          <NewProjectMenu onCreate={startCreate} onClone={() => setCloneOpen(true)} />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
            <FilePlus2 className="size-7" />
          </div>
          <p className="text-lg font-medium">No projects yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Create a Spicetify project to edit its CSS and JS with live apply.
          </p>
          <NewProjectMenu
            align="center"
            onCreate={startCreate}
            onClone={() => setCloneOpen(true)}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card
              key={p.name}
              className="hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={() => openEditor(p)}
            >
              <CardContent className="grid gap-3 p-4">
                <div className="flex items-center gap-2">
                  <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                    <Box className="size-4" />
                  </div>
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  {p.version && (
                    <Badge variant="outline" className="ml-auto shrink-0">
                      v{p.version}
                    </Badge>
                  )}
                </div>
                {p.description && (
                  <p className="text-muted-foreground line-clamp-2 text-xs">{p.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {p.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                  {p.authors.length > 0 && (
                    <span className="text-muted-foreground ml-auto text-xs">
                      {p.authors.join(", ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground truncate font-mono text-[11px]">
                    {p.entries.js}
                    {p.entries.css ? ` / ${p.entries.css}` : ""}
                  </span>
                  <div className="ml-auto flex shrink-0 items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      title="Edit project"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(p);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive size-7 p-0"
                      title="Delete project"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(p);
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditor(p);
                      }}
                    >
                      <FolderOpen /> Open
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} />
      <CloneDialog open={cloneOpen} onOpenChange={setCloneOpen} />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(v) => !v && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-medium">{confirmDelete?.name}</span>{" "}
              and all its files from disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) void deleteProject(confirmDelete.name);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

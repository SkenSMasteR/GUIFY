import { useState } from "react";
import { FilePlus2, FolderOpen, Plus, Box } from "lucide-react";
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

function draftToMeta(draft: Draft): ProjectMeta {
  const withSuffix = (file: string, suffix: string) =>
    file && !file.endsWith(suffix) ? `${file}${suffix}` : file;
  return {
    name: draft.name.trim(),
    tags: parseList(draft.tags),
    version: draft.version.trim() || "0.0.0",
    authors: parseList(draft.authors),
    description: draft.description.trim(),
    entries: {
      js: withSuffix(draft.js.trim(), ".js"),
      css: withSuffix(draft.css.trim(), ".css"),
    },
    hasMixins: draft.hasMixins,
    dependencies: parseDependencies(draft.dependencies),
    preview: draft.preview.trim(),
  };
}

function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { createProject, openEditor } = useDevMode();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const meta = draftToMeta(draft);
  const valid = meta.name.length > 0 && meta.entries.js.length > 0 && meta.entries.css.length > 0;

  const submit = async () => {
    setBusy(true);
    const created = await createProject(meta);
    setBusy(false);
    if (created) {
      setDraft(EMPTY_DRAFT);
      onOpenChange(false);
      openEditor(meta);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dm-name">Name</Label>
              <Input
                id="dm-name"
                value={draft.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="spotui"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dm-version">Version</Label>
              <Input
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
              id="dm-description"
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Terminal interface for Spotify…"
              rows={3}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dm-authors">Authors</Label>
              <Input
                id="dm-authors"
                value={draft.authors}
                onChange={(e) => set({ authors: e.target.value })}
                placeholder="SkenS, Alice"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dm-tags">Tags</Label>
              <Input
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
                id="dm-js"
                value={draft.js}
                onChange={(e) => set({ js: e.target.value })}
                placeholder="theme.js"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dm-css">CSS entry</Label>
              <Input
                id="dm-css"
                value={draft.css}
                onChange={(e) => set({ css: e.target.value })}
                placeholder="user.css"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="dm-deps">Dependencies</Label>
              <Input
                id="dm-deps"
                value={draft.dependencies}
                onChange={(e) => set({ dependencies: e.target.value })}
                placeholder="stdlib@^1.2.0"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dm-preview">Preview URL</Label>
              <Input
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
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectsView() {
  const { projects, loading, openEditor } = useDevMode();
  const [creating, setCreating] = useState(false);

  return (
    <div className="grid gap-6 p-6">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold">
          Projects{" "}
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
            {projects.length}
          </span>
        </h2>
        <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
          <Plus /> New project
        </Button>
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
          <Button onClick={() => setCreating(true)}>
            <Plus /> New project
          </Button>
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
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {p.entries.js} · {p.entries.css}
                  </span>
                  <Button size="sm" variant="outline" className="ml-auto" onClick={(e) => { e.stopPropagation(); openEditor(p); }}>
                    <FolderOpen /> Open
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewProjectDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

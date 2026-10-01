import { useMemo, useState } from "react";
import { Check, Code2, Loader2, Pencil, Plus, RadioTower, Trash2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SNIPPET_EXT, type Snippet } from "@/lib/api";
import { useApp } from "@/lib/store";

const EMPTY: Snippet = { id: "", title: "", css: "", enabled: true };

export function Snippets() {
  const {
    snippets,
    saveSnippet,
    deleteSnippet,
    setSnippetsEnabled,
    enabledExtensions,
    busy,
  } = useApp();

  const bridgeOn = enabledExtensions.includes(SNIPPET_EXT);
  const isBusy = busy === "snippets";
  const [editing, setEditing] = useState<Snippet | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Snippet | null>(null);

  const sorted = useMemo(
    () =>
      [...snippets].sort(
        (a, b) =>
          Number(b.enabled) - Number(a.enabled) || a.title.localeCompare(b.title),
      ),
    [snippets],
  );

  return (
    <div className="grid gap-6 p-6">
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-xl">
            <RadioTower className="size-5" />
          </div>
          <div className="grid flex-1 gap-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">Enable snippets</p>
              {bridgeOn && (
                <Badge className="gap-1">
                  <Check className="size-3" /> Bridge on
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              Injects your snippets into Spotify every time it starts
            </p>
          </div>
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Switch
              checked={bridgeOn}
              onCheckedChange={(v) => void setSnippetsEnabled(v)}
              aria-label="Enable snippets"
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <h2 className="text-sm font-semibold">
          Snippets{" "}
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
            {snippets.length}
          </span>
        </h2>
        <Button size="sm" className="ml-auto" onClick={() => setEditing({ ...EMPTY })}>
          <Plus /> New snippet
        </Button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
            <Code2 className="size-7" />
          </div>
          <p className="text-lg font-medium">No snippets yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Create a CSS snippet to inject custom styles into Spotify.
          </p>
          <Button onClick={() => setEditing({ ...EMPTY })}>
            <Plus /> New snippet
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s) => (
            <Card key={s.id} className={!s.enabled ? "opacity-70" : undefined}>
              <CardContent className="grid gap-3 p-4">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <Switch
                    className="ml-auto shrink-0"
                    checked={s.enabled}
                    onCheckedChange={() => void saveSnippet({ ...s, enabled: !s.enabled })}
                    aria-label={`Enable ${s.title}`}
                  />
                </div>
                <pre className="bg-muted text-muted-foreground line-clamp-4 overflow-hidden rounded-md p-2 font-mono text-[11px] whitespace-pre-wrap">
                  {s.css}
                </pre>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing({ ...s })}>
                    <Pencil /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive ml-auto"
                    onClick={() => setConfirmDelete(s)}
                  >
                    <Trash2 /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {snippets.length > 0 && !bridgeOn && (
        <p className="text-muted-foreground text-xs">
          Enable snippets above and apply Spicetify to see them in Spotify.
        </p>
      )}

      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit snippet" : "New snippet"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="snippet-title">Title</Label>
                <Input
                  id="snippet-title"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Compact player bar"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="snippet-css">CSS</Label>
                <Textarea
                  id="snippet-css"
                  value={editing.css}
                  onChange={(e) => setEditing({ ...editing, css: e.target.value })}
                  className="min-h-64 font-mono text-xs"
                  placeholder={".main-view {\n  background: red;\n}"}
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="snippet-enabled"
                  checked={editing.enabled}
                  onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
                />
                <Label htmlFor="snippet-enabled" className="text-muted-foreground text-sm">
                  Enabled
                </Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={!editing?.title.trim() || !editing?.css.trim()}
              onClick={async () => {
                if (!editing) return;
                await saveSnippet(editing);
                setEditing(null);
              }}
            >
              Save snippet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete snippet?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <span className="font-medium">{confirmDelete?.title}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) void deleteSnippet(confirmDelete.id);
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

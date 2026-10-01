import { useMemo, useState } from "react";
import {
  Play,
  Power,
  Trash2,
  ExternalLink,
  Palette,
  Puzzle,
  Scissors,
  Package,
  Copy,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuleCard } from "@/components/ModuleCard";
import { SnippetDialog } from "@/components/SnippetDialog";
import { InstalledDialog, type InstalledTarget } from "@/components/InstalledDialog";
import { openUrl, type MarketSnippet } from "@/lib/api";
import { useApp } from "@/lib/store";

type Confirm = { kind: "theme" | "ext" | "snippet"; name: string; id?: string } | null;
type Detail = { kind: "theme" | "ext"; name: string } | null;

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

function SectionHeading({ icon: Icon, title, count }: { icon: LucideIcon; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="text-muted-foreground size-4" />
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">{count}</span>
    </div>
  );
}

function TabEmpty({
  icon: Icon,
  message,
  action,
  onAction,
}: {
  icon: LucideIcon;
  message: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="bg-muted flex size-12 items-center justify-center rounded-2xl">
        <Icon className="size-6" />
      </div>
      <p className="text-muted-foreground max-w-sm text-sm">{message}</p>
      <Button variant="outline" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

export function Installed() {
  const {
    localThemes,
    localExtensions,
    marketSnippets,
    installs,
    activeTheme,
    enabledExtensions,
    advanced,
    activate,
    remove,
    removeExt,
    toggleExtEnabled,
    removeSnippet,
    toggleSnippet,
    busy,
    setView,
  } = useApp();
  const [tab, setTab] = useState("themes");
  const [detail, setDetail] = useState<Detail>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [snippetDetail, setSnippetDetail] = useState<MarketSnippet | null>(null);

  const enabled = useMemo(() => new Set(enabledExtensions), [enabledExtensions]);

  const themes = useMemo(
    () =>
      [...localThemes].sort(
        (a, b) =>
          Number(b.name === activeTheme) - Number(a.name === activeTheme) ||
          a.name.localeCompare(b.name),
      ),
    [localThemes, activeTheme],
  );

  const exts = useMemo(
    () =>
      [...localExtensions].sort(
        (a, b) =>
          Number(enabled.has(b.name)) - Number(enabled.has(a.name)) ||
          a.name.localeCompare(b.name),
      ),
    [localExtensions, enabled],
  );

  const snippets = useMemo(
    () =>
      [...marketSnippets].sort(
        (a, b) => Number(b.enabled) - Number(a.enabled) || a.title.localeCompare(b.title),
      ),
    [marketSnippets],
  );

  const detailTarget = useMemo<InstalledTarget | null>(() => {
    if (!detail) return null;
    if (detail.kind === "theme") {
      const t = localThemes.find((x) => x.name === detail.name);
      if (!t) return null;
      return { kind: "theme", name: t.name, schemes: t.schemes, active: t.name === activeTheme };
    }
    const e = localExtensions.find((x) => x.name === detail.name);
    if (!e) return null;
    return { kind: "ext", name: e.name, active: enabled.has(e.name) };
  }, [detail, localThemes, localExtensions, activeTheme, enabled]);

  const detailOrigin = useMemo(
    () => (detailTarget ? installs.find((i) => i.name === detailTarget.name) : undefined),
    [detailTarget, installs],
  );

  if (localThemes.length === 0 && localExtensions.length === 0 && marketSnippets.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 p-12 text-center">
        <div className="bg-muted flex size-14 items-center justify-center rounded-2xl">
          <Package className="size-7" />
        </div>
        <p className="text-lg font-medium">Nothing installed yet</p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Browse the catalogue and install a theme, extension or snippet.
        </p>
        <Button onClick={() => setView("browse")}>Browse Modules</Button>
      </div>
    );
  }

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const confirmLabel =
    confirm?.kind === "ext" ? "extension" : confirm?.kind === "snippet" ? "snippet" : "theme";

  return (
    <div className="grid gap-4 p-6">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="extensions">Extensions</TabsTrigger>
          <TabsTrigger value="snippets">Snippets</TabsTrigger>
        </TabsList>

        <TabsContent value="themes" className="mt-4 grid gap-3">
          {themes.length === 0 ? (
            <TabEmpty
              icon={Palette}
              message="No themes installed yet. Grab one from the marketplace to restyle Spotify."
              action="Browse themes"
              onAction={() => setView("browse")}
            />
          ) : (
            <>
              <SectionHeading icon={Palette} title="Themes" count={themes.length} />
              <div className={GRID}>
                {themes.map((t) => {
                  const isActive = t.name === activeTheme;
                  const origin = installs.find((i) => i.name === t.name);
                  const isBusy = busy === t.name;
                  const repoUrl = origin ? `https://github.com/${origin.user}/${origin.repo}` : null;
                  return (
                    <ContextMenu key={t.name}>
                      <ContextMenuTrigger asChild>
                        <ModuleCard
                          title={t.name}
                          subtitle={origin ? `${origin.user}/${origin.repo}` : "Local theme"}
                          imageUrl={origin?.imageUrl}
                          fallback={<span className="text-4xl font-bold opacity-20">{t.name.charAt(0)}</span>}
                          active={isActive}
                          activeLabel="Active"
                          onClick={() => setDetail({ kind: "theme", name: t.name })}
                        >
                          {advanced && t.schemes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {t.schemes.map((s) => (
                                <Badge key={s} variant="secondary" className="text-[10px]">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </ModuleCard>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem disabled={isActive || isBusy} onClick={() => void activate(t.name, null)}>
                          <Play /> Apply theme
                        </ContextMenuItem>
                        {repoUrl && (
                          <ContextMenuItem onClick={() => void openUrl(repoUrl)}>
                            <ExternalLink /> Open repository
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem onClick={() => copy(t.name)}>
                          <Copy /> Copy name
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={isBusy}
                          onClick={() => setConfirm({ kind: "theme", name: t.name })}
                        >
                          <Trash2 /> Remove
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="extensions" className="mt-4 grid gap-3">
          {exts.length === 0 ? (
            <TabEmpty
              icon={Puzzle}
              message="No extensions installed yet. Add extras like lyrics, stats and more."
              action="Browse extensions"
              onAction={() => setView("browse")}
            />
          ) : (
            <>
              <SectionHeading icon={Puzzle} title="Extensions" count={exts.length} />
              <div className={GRID}>
                {exts.map((e) => {
                  const isOn = enabled.has(e.name);
                  const origin = installs.find((i) => i.name === e.name);
                  const isBusy = busy === e.name;
                  const label = e.name.replace(/\.js$/i, "");
                  const repoUrl = origin ? `https://github.com/${origin.user}/${origin.repo}` : null;
                  return (
                    <ContextMenu key={e.name}>
                      <ContextMenuTrigger asChild>
                        <ModuleCard
                          title={label}
                          subtitle={origin ? `${origin.user}/${origin.repo}` : "Local extension"}
                          imageUrl={origin?.imageUrl}
                          fallback={<span className="text-4xl font-bold opacity-20">{label.charAt(0)}</span>}
                          active={isOn}
                          activeLabel="On"
                          onClick={() => setDetail({ kind: "ext", name: e.name })}
                        />
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem disabled={isBusy} onClick={() => void toggleExtEnabled(e.name, !isOn)}>
                          {isOn ? <Power /> : <Play />} {isOn ? "Disable" : "Enable"}
                        </ContextMenuItem>
                        {repoUrl && (
                          <ContextMenuItem onClick={() => void openUrl(repoUrl)}>
                            <ExternalLink /> Open repository
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem onClick={() => copy(label)}>
                          <Copy /> Copy name
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={isBusy}
                          onClick={() => setConfirm({ kind: "ext", name: e.name })}
                        >
                          <Trash2 /> Remove
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="snippets" className="mt-4 grid gap-3">
          {snippets.length === 0 ? (
            <TabEmpty
              icon={Scissors}
              message="No snippets added yet. Grab CSS snippets from the marketplace."
              action="Browse snippets"
              onAction={() => setView("browse")}
            />
          ) : (
            <>
              <SectionHeading icon={Scissors} title="Snippets" count={snippets.length} />
              <div className={GRID}>
                {snippets.map((s) => {
                  const isBusy = busy === s.id;
                  return (
                    <ContextMenu key={s.id}>
                      <ContextMenuTrigger asChild>
                        <ModuleCard
                          title={s.title}
                          subtitle={s.description}
                          imageUrl={s.previewUrl}
                          fallback={<Scissors className="size-10 opacity-20" />}
                          active={s.enabled}
                          activeLabel="On"
                          className={!s.enabled ? "opacity-80" : undefined}
                          onClick={() => setSnippetDetail(s)}
                        />
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem disabled={isBusy} onClick={() => void toggleSnippet(s.id, !s.enabled)}>
                          {s.enabled ? <Power /> : <Play />} {s.enabled ? "Disable" : "Enable"}
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => copy(s.code)}>
                          <Copy /> Copy CSS
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={isBusy}
                          onClick={() => setConfirm({ kind: "snippet", name: s.title, id: s.id })}
                        >
                          <Trash2 /> Remove
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <InstalledDialog
        target={detailTarget}
        origin={detailOrigin}
        open={detailTarget !== null}
        onOpenChange={(v) => !v && setDetail(null)}
        onRemove={() => {
          if (!detailTarget) return;
          setConfirm({ kind: detailTarget.kind, name: detailTarget.name });
          setDetail(null);
        }}
      />

      <SnippetDialog
        card={snippetDetail}
        open={snippetDetail !== null}
        onOpenChange={(v) => !v && setSnippetDetail(null)}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "snippet" ? (
                <>
                  This removes <span className="font-medium">{confirm?.name}</span> from your snippets and
                  regenerates the snippets extension.
                </>
              ) : (
                <>
                  This deletes <span className="font-medium">{confirm?.name}</span> from your Spicetify{" "}
                  {confirm?.kind === "ext" ? "extensions" : "themes"} folder.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirm?.kind === "ext") void removeExt(confirm.name);
                else if (confirm?.kind === "snippet" && confirm.id) void removeSnippet(confirm.id);
                else if (confirm) void remove(confirm.name);
                setConfirm(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

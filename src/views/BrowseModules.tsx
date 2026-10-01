import { useMemo, useState } from "react";
import { Search, Loader2, RadioTower } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeCardItem } from "@/components/ThemeCardItem";
import { ExtensionCardItem } from "@/components/ExtensionCardItem";
import { SnippetCardItem } from "@/components/SnippetCardItem";
import { ThemeDialog } from "@/components/ThemeDialog";
import { ExtensionDialog } from "@/components/ExtensionDialog";
import { SnippetDialog } from "@/components/SnippetDialog";
import type { ThemeCard, ExtensionCard, SnippetCard } from "@/lib/api";
import { SNIPPET_EXT } from "@/lib/api";
import { useApp } from "@/lib/store";

const GRID = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

function matches(q: string, fields: string[]) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f.toLowerCase().includes(needle));
}

export function BrowseModules() {
  const {
    cards,
    browseLoading,
    showArchived,
    setShowArchived,
    moreBrowse,
    extCards,
    extLoading,
    moreExtensions,
    snippetCards,
    snippetLoading,
    enabledExtensions,
    setSnippetsEnabled,
    spotifyConnected,
    applyChanges,
    busy,
  } = useApp();

  const [themeQuery, setThemeQuery] = useState("");
  const [extQuery, setExtQuery] = useState("");
  const [snippetQuery, setSnippetQuery] = useState("");
  const [tab, setTab] = useState("themes");
  const [selected, setSelected] = useState<ThemeCard | null>(null);
  const [open, setOpen] = useState(false);
  const [extSelected, setExtSelected] = useState<ExtensionCard | null>(null);
  const [extOpen, setExtOpen] = useState(false);
  const [snippetSelected, setSnippetSelected] = useState<SnippetCard | null>(null);
  const [snippetOpen, setSnippetOpen] = useState(false);

  const bridgeOn = enabledExtensions.includes(SNIPPET_EXT);

  const query = tab === "themes" ? themeQuery : tab === "extensions" ? extQuery : snippetQuery;
  const setQuery = tab === "themes" ? setThemeQuery : tab === "extensions" ? setExtQuery : setSnippetQuery;

  const themes = useMemo(
    () =>
      cards.filter((c) =>
        matches(themeQuery, [c.title, c.subtitle, c.repo, c.user, ...c.tags, ...c.authors.map((a) => a.name)]),
      ),
    [cards, themeQuery],
  );
  const exts = useMemo(
    () =>
      extCards.filter((c) =>
        matches(extQuery, [c.title, c.subtitle, c.repo, c.user, ...c.tags, ...c.authors.map((a) => a.name)]),
      ),
    [extCards, extQuery],
  );
  const snips = useMemo(
    () => snippetCards.filter((c) => matches(snippetQuery, [c.title, c.description])),
    [snippetCards, snippetQuery],
  );

  return (
    <div className="grid gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "themes" ? "Search themes…" : tab === "extensions" ? "Search extensions…" : "Search snippets…"
            }
            className="pl-9"
          />
        </div>
        {tab === "themes" && (
          <div className="flex items-center gap-2">
            <Switch id="archived" checked={showArchived} onCheckedChange={(v) => setShowArchived(v)} />
            <Label htmlFor="archived" className="text-muted-foreground text-sm">
              Include archived
            </Label>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center gap-3">
          <TabsList>
            <TabsTrigger value="themes">Themes</TabsTrigger>
            <TabsTrigger value="extensions">Extensions</TabsTrigger>
            <TabsTrigger value="snippets">Snippets</TabsTrigger>
          </TabsList>
          <span className="text-muted-foreground ml-auto text-sm">
            {tab === "themes"
              ? `${themes.length} themes`
              : tab === "extensions"
                ? `${exts.length} extensions`
                : spotifyConnected
                  ? `${snips.length} snippets`
                  : ""}
          </span>
        </div>

        <TabsContent value="themes" className="mt-4">
          {browseLoading && cards.length === 0 ? (
            <div className={GRID}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className={GRID}>
                {themes.map((c) => (
                  <ThemeCardItem
                    key={`${c.user}/${c.repo}/${c.title}`}
                    card={c}
                    onOpen={() => {
                      setSelected(c);
                      setOpen(true);
                    }}
                  />
                ))}
              </div>
              {themes.length === 0 && (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  {browseLoading ? "Loading…" : "No themes found."}
                </p>
              )}
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={() => void moreBrowse()} disabled={browseLoading}>
                  {browseLoading ? <Loader2 className="animate-spin" /> : null} Load more
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="extensions" className="mt-4">
          {extLoading && extCards.length === 0 ? (
            <div className={GRID}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div className={GRID}>
                {exts.map((c) => (
                  <ExtensionCardItem
                    key={`${c.user}/${c.repo}/${c.title}`}
                    card={c}
                    onOpen={() => {
                      setExtSelected(c);
                      setExtOpen(true);
                    }}
                  />
                ))}
              </div>
              {exts.length === 0 && (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  {extLoading ? "Loading…" : "No extensions found."}
                </p>
              )}
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={() => void moreExtensions()} disabled={extLoading}>
                  {extLoading ? <Loader2 className="animate-spin" /> : null} Load more
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="snippets" className="mt-4">
          {!bridgeOn ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <RadioTower className="text-muted-foreground size-8" />
              <div>
                <p className="font-medium">Snippets are disabled</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Enable snippets to browse and add them from the marketplace.
                </p>
              </div>
              <Button
                disabled={busy === "snippets"}
                onClick={() => void setSnippetsEnabled(true)}
              >
                {busy === "snippets" ? <Loader2 className="animate-spin" /> : null}
                Enable snippets
              </Button>
            </div>
          ) : !spotifyConnected ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <RadioTower className="text-muted-foreground size-8" />
              <div>
                <p className="font-medium">Spotify is not connected</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Apply changes to browse snippets.
                </p>
              </div>
              <Button disabled={busy === "apply"} onClick={() => void applyChanges()}>
                {busy === "apply" ? <Loader2 className="animate-spin" /> : null}
                Apply changes
              </Button>
            </div>
          ) : (
            <>
              {snippetLoading && snippetCards.length === 0 ? (
                <div className={GRID}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className={GRID}>
                  {snips.map((c) => (
                    <SnippetCardItem
                      key={c.id}
                      card={c}
                      onOpen={() => {
                        setSnippetSelected(c);
                        setSnippetOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
              {!snippetLoading && snips.length === 0 && (
                <p className="text-muted-foreground py-12 text-center text-sm">
                  {snippetCards.length === 0 ? "Could not load snippets." : "No snippets found."}
                </p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <ThemeDialog card={selected} open={open} onOpenChange={setOpen} />
      <ExtensionDialog card={extSelected} open={extOpen} onOpenChange={setExtOpen} />
      <SnippetDialog card={snippetSelected} open={snippetOpen} onOpenChange={setSnippetOpen} />
    </div>
  );
}

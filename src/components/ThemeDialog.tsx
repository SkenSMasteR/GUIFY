import { useEffect, useMemo, useState } from "react";
import { Star, ExternalLink, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getReadme, openUrl, type ThemeCard } from "@/lib/api";
import { useApp } from "@/lib/store";

function parseSchemes(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (m && m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

export function ThemeDialog({
  card,
  open,
  onOpenChange,
}: {
  card: ThemeCard | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { install, busy } = useApp();
  const [schemes, setSchemes] = useState<string[]>([]);
  const [scheme, setScheme] = useState<string>("");
  const [loadingSchemes, setLoadingSchemes] = useState(false);

  useEffect(() => {
    if (!open || !card) return;
    setScheme("");
    setSchemes([]);
    if (!card.schemesUrl) return;
    let live = true;
    setLoadingSchemes(true);
    getReadme(card.schemesUrl)
      .then((text) => {
        if (!live) return;
        const found = parseSchemes(text);
        setSchemes(found);
        if (found.length) setScheme(found[0]);
      })
      .catch(() => {})
      .finally(() => {
        if (live) setLoadingSchemes(false);
      });
    return () => {
      live = false;
    };
  }, [open, card]);

  const authorLine = useMemo(
    () => (card ? card.authors.map((a) => a.name).join(", ") || card.user : ""),
    [card],
  );

  if (!card) return null;
  const installing = busy === card.repo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {card.title}
            {card.archived && <Badge variant="secondary">Archived</Badge>}
          </DialogTitle>
          <DialogDescription>
            {card.subtitle || `by ${authorLine}`}
          </DialogDescription>
        </DialogHeader>

        {card.imageUrl && (
          <img
            src={card.imageUrl}
            alt={card.title}
            className="rounded-lg border object-cover object-top max-h-64 w-full"
          />
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="gap-1">
            <Star className="size-3" /> {card.stars}
          </Badge>
          <Badge variant="outline">{authorLine}</Badge>
          {card.tags.slice(0, 6).map((t) => (
            <Badge key={t} variant="secondary">
              {t}
            </Badge>
          ))}
        </div>

        {(schemes.length > 0 || loadingSchemes) && (
          <div className="grid gap-2">
            <Label htmlFor="scheme">Color scheme</Label>
            {loadingSchemes ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> Loading schemes…
              </div>
            ) : (
              <Select value={scheme} onValueChange={setScheme}>
                <SelectTrigger id="scheme" className="w-56">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  {schemes.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => void openUrl(`https://github.com/${card.user}/${card.repo}`)}>
              <ExternalLink /> Repo
            </Button>
            {card.readmeUrl && (
              <Button variant="ghost" size="sm" onClick={() => void openUrl(`https://github.com/${card.user}/${card.repo}/blob/${card.branch}/README.md`)}>
                <ExternalLink /> Readme
              </Button>
            )}
          </div>
          <Button
            onClick={async () => {
              await install(card, scheme || null);
              onOpenChange(false);
            }}
            disabled={installing}
          >
            {installing ? <Loader2 className="animate-spin" /> : null}
            Install &amp; apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo } from "react";
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
import { openUrl, type ExtensionCard } from "@/lib/api";
import { extensionFileName } from "@/lib/utils";
import { useApp } from "@/lib/store";

export function ExtensionDialog({
  card,
  open,
  onOpenChange,
}: {
  card: ExtensionCard | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { installExt, removeExt, busy, enabledExtensions, localExtensions } = useApp();

  const authorLine = useMemo(
    () => (card ? card.authors.map((a) => a.name).join(", ") || card.user : ""),
    [card],
  );

  if (!card) return null;
  const file = extensionFileName(card);
  const isOn = enabledExtensions.includes(file);
  const installed = localExtensions.some((e) => e.name === file);
  const isBusy = busy === card.repo || busy === file;

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
          {isOn ? (
            <Button
              variant="outline"
              disabled={isBusy}
              onClick={async () => {
                await removeExt(file);
                onOpenChange(false);
              }}
            >
              {isBusy ? <Loader2 className="animate-spin" /> : null}
              Remove
            </Button>
          ) : (
            <Button
              disabled={isBusy}
              onClick={async () => {
                await installExt(card);
                onOpenChange(false);
              }}
            >
              {isBusy ? <Loader2 className="animate-spin" /> : null}
              {installed ? "Enable" : "Install"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

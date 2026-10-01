import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MarketSnippet, SnippetCard } from "@/lib/api";
import { useApp } from "@/lib/store";

export function SnippetDialog({
  card,
  open,
  onOpenChange,
}: {
  card: SnippetCard | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { addSnippet, removeSnippet, toggleSnippet, marketSnippets, busy } = useApp();

  if (!card) return null;
  const current: MarketSnippet | undefined = marketSnippets.find((s) => s.id === card.id);
  const isBusy = busy === card.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{card.title}</DialogTitle>
          <DialogDescription>{card.description}</DialogDescription>
        </DialogHeader>

        {card.previewUrl && (
          <img
            src={card.previewUrl}
            alt=""
            className="bg-muted max-h-48 w-full rounded-lg border object-contain"
          />
        )}

        <pre className="bg-muted text-muted-foreground max-h-64 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
          {card.code}
        </pre>

        <DialogFooter className="gap-2 sm:justify-between">
          {current ? (
            <>
              <div className="flex items-center gap-2">
                <Switch
                  id="snippet-dialog-enabled"
                  checked={current.enabled}
                  disabled={isBusy}
                  onCheckedChange={(v) => void toggleSnippet(card.id, v)}
                />
                <Label htmlFor="snippet-dialog-enabled" className="text-muted-foreground text-sm">
                  Enabled
                </Label>
              </div>
              <Button
                variant="outline"
                disabled={isBusy}
                onClick={async () => {
                  await removeSnippet(card.id);
                  onOpenChange(false);
                }}
              >
                {isBusy ? <Loader2 className="animate-spin" /> : null}
                Remove
              </Button>
            </>
          ) : (
            <Button
              disabled={isBusy}
              onClick={async () => {
                await addSnippet(card);
                onOpenChange(false);
              }}
            >
              {isBusy ? <Loader2 className="animate-spin" /> : null}
              Add snippet
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

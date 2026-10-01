import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
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
import { openUrl, type InstallOrigin } from "@/lib/api";
import { useApp } from "@/lib/store";

export type InstalledTarget =
  | { kind: "theme"; name: string; schemes: string[]; active: boolean }
  | { kind: "ext"; name: string; active: boolean };

export function InstalledDialog({
  target,
  origin,
  open,
  onOpenChange,
  onRemove,
}: {
  target: InstalledTarget | null;
  origin?: InstallOrigin;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRemove: () => void;
}) {
  const { activate, toggleExtEnabled, busy } = useApp();
  const [scheme, setScheme] = useState("");

  useEffect(() => {
    setScheme("");
  }, [target]);

  if (!target) return null;
  const isBusy = busy === target.name;
  const label = target.kind === "ext" ? target.name.replace(/\.js$/i, "") : target.name;
  const schemes = target.kind === "theme" ? target.schemes : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {label}
            {target.active && (
              <Badge className="gap-1">
                <Check className="size-3" /> {target.kind === "theme" ? "Active" : "On"}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {origin
              ? `${origin.user}/${origin.repo}`
              : target.kind === "theme"
                ? "Local theme"
                : "Local extension"}
          </DialogDescription>
        </DialogHeader>

        {origin?.imageUrl && (
          <img
            src={origin.imageUrl}
            alt={label}
            className="rounded-lg border object-cover object-top max-h-64 w-full"
          />
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {origin && (
            <Badge variant="outline">{origin.user}/{origin.repo}</Badge>
          )}
          <Badge variant="secondary">
            {target.kind === "theme" ? "Theme" : "Extension"}
          </Badge>
        </div>

        {schemes.length > 0 && (
          <div className="grid gap-2">
            <Label htmlFor="installed-scheme">Color scheme</Label>
            <Select value={scheme} onValueChange={setScheme}>
              <SelectTrigger id="installed-scheme" className="w-56">
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
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {origin && (
              <>
                <Button variant="ghost" size="sm" onClick={() => void openUrl(`https://github.com/${origin.user}/${origin.repo}`)}>
                  <ExternalLink /> Repo
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void openUrl(`https://github.com/${origin.user}/${origin.repo}/blob/${origin.branch}/README.md`)}>
                  <ExternalLink /> Readme
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={isBusy}
              onClick={onRemove}
            >
              Remove
            </Button>
            {target.kind === "theme" ? (
              <Button
                disabled={target.active || isBusy}
                onClick={async () => {
                  await activate(target.name, scheme || null);
                  onOpenChange(false);
                }}
              >
                {isBusy ? <Loader2 className="animate-spin" /> : null}
                {target.active ? "Applied" : "Apply"}
              </Button>
            ) : (
              <Button
                variant={target.active ? "outline" : "default"}
                disabled={isBusy}
                onClick={async () => {
                  await toggleExtEnabled(target.name, !target.active);
                  onOpenChange(false);
                }}
              >
                {isBusy ? <Loader2 className="animate-spin" /> : null}
                {target.active ? "Disable" : "Enable"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

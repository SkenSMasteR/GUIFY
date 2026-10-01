import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";

export function ApplyPill() {
  const { pending, applyChanges, busy } = useApp();
  if (!pending) return null;
  const applying = busy === "apply";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="bg-popover text-popover-foreground pointer-events-auto flex items-center gap-3 rounded-full border shadow-lg pl-4 pr-1.5 py-1.5">
        <span className="text-sm">You have changes ready to apply</span>
        <Button size="sm" className="rounded-full" onClick={() => void applyChanges()} disabled={applying}>
          {applying ? <Loader2 className="animate-spin" /> : <Check />}
          Apply changes
        </Button>
      </div>
    </div>
  );
}

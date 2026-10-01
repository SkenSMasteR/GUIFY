import { Code2, Copy, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ModuleCard } from "@/components/ModuleCard";
import type { SnippetCard } from "@/lib/api";
import { useApp } from "@/lib/store";

export function SnippetCardItem({
  card,
  onOpen,
}: {
  card: SnippetCard;
  onOpen: () => void;
}) {
  const { marketSnippets, busy, addSnippet, removeSnippet } = useApp();
  const installed = marketSnippets.some((s) => s.id === card.id);
  const isBusy = busy === card.id;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <ModuleCard
          title={card.title}
          subtitle={card.description}
          imageUrl={card.previewUrl}
          active={installed}
          activeLabel="Added"
          fallback={<Code2 className="size-10 opacity-20" />}
          onClick={onOpen}
        />
      </ContextMenuTrigger>
      <ContextMenuContent>
        {installed ? (
          <ContextMenuItem disabled={isBusy} onClick={() => void removeSnippet(card.id)}>
            <Trash2 /> Remove
          </ContextMenuItem>
        ) : (
          <ContextMenuItem disabled={isBusy} onClick={() => void addSnippet(card)}>
            <Download /> Add snippet
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            void navigator.clipboard.writeText(card.code);
            toast.success("Copied CSS");
          }}
        >
          <Copy /> Copy CSS
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

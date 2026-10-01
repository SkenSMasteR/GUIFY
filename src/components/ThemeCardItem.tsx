import { Copy, ExternalLink, Download } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import { ModuleCard } from "@/components/ModuleCard";
import { openUrl, type ThemeCard } from "@/lib/api";
import { useApp } from "@/lib/store";

export function ThemeCardItem({
  card,
  onOpen,
}: {
  card: ThemeCard;
  onOpen: () => void;
}) {
  const { advanced, install, busy } = useApp();
  const repoUrl = `https://github.com/${card.user}/${card.repo}`;
  const authorLine = card.authors.map((a) => a.name).join(", ") || card.user;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <ModuleCard
          title={card.title}
          subtitle={authorLine}
          imageUrl={card.imageUrl}
          stars={card.stars}
          fallback={<span className="text-4xl font-bold opacity-20">{card.title.charAt(0)}</span>}
          onClick={onOpen}
        >
          {card.archived && <Badge variant="secondary">Archived</Badge>}
          {advanced && (
            <p className="text-muted-foreground truncate font-mono text-[10px]">
              {card.user}/{card.repo}@{card.branch}
            </p>
          )}
        </ModuleCard>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem disabled={busy === card.repo} onClick={() => void install(card, null)}>
          <Download /> Install &amp; apply
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => void openUrl(repoUrl)}>
          <ExternalLink /> Open repository
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            void navigator.clipboard.writeText(card.title);
            toast.success("Copied name");
          }}
        >
          <Copy /> Copy name
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

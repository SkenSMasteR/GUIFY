import { Copy, ExternalLink, Download, Trash2 } from "lucide-react";
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
import { openUrl, type ExtensionCard } from "@/lib/api";
import { extensionFileName } from "@/lib/utils";
import { useApp } from "@/lib/store";

export function ExtensionCardItem({
  card,
  onOpen,
}: {
  card: ExtensionCard;
  onOpen: () => void;
}) {
  const { advanced, installExt, removeExt, busy, enabledExtensions, localExtensions } = useApp();
  const file = extensionFileName(card);
  const isOn = enabledExtensions.includes(file);
  const installed = localExtensions.some((e) => e.name === file);
  const isBusy = busy === card.repo || busy === file;
  const authorLine = card.authors.map((a) => a.name).join(", ") || card.user;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <ModuleCard
          title={card.title}
          subtitle={authorLine}
          imageUrl={card.imageUrl}
          stars={card.stars}
          active={isOn}
          activeLabel="On"
          fallback={<span className="text-4xl font-bold opacity-20">{card.title.charAt(0)}</span>}
          onClick={onOpen}
        >
          {card.archived && <Badge variant="secondary">Archived</Badge>}
          {!isOn && installed && <Badge variant="secondary">Installed</Badge>}
          {advanced && (
            <p className="text-muted-foreground truncate font-mono text-[10px]">
              {card.user}/{card.repo}@{card.branch}
            </p>
          )}
        </ModuleCard>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isOn ? (
          <ContextMenuItem disabled={isBusy} onClick={() => void removeExt(file)}>
            <Trash2 /> Remove
          </ContextMenuItem>
        ) : (
          <ContextMenuItem disabled={isBusy} onClick={() => void installExt(card)}>
            <Download /> {installed ? "Enable" : "Install"}
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => void openUrl(`https://github.com/${card.user}/${card.repo}`)}>
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

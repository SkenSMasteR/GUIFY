import type { ExtensionCard } from "@/lib/api";

export { cn } from "cn"

export function extensionFileName(card: ExtensionCard) {
  const stem = (card.repo || card.title).replace(/[/\\:*?"<>|]/g, "_").trim();
  return `${stem}.js`;
}

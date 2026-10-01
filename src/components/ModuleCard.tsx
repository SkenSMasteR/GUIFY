import type { ComponentProps, ReactNode } from "react";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ModuleCardProps = ComponentProps<typeof Card> & {
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  fallback?: ReactNode;
  stars?: number;
  active?: boolean;
  activeLabel?: string;
  footer?: ReactNode;
};

export function ModuleCard({
  title,
  subtitle,
  imageUrl,
  fallback,
  stars,
  active = false,
  activeLabel = "Active",
  footer,
  className,
  children,
  ...rest
}: ModuleCardProps) {
  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden transition-shadow",
        active ? "ring-2 ring-primary" : "hover:ring-primary/40",
        className,
      )}
      {...rest}
    >
      <div className="bg-muted relative aspect-video w-full shrink-0 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center">{fallback}</div>
        )}
        {active && (
          <Badge className="absolute top-2 left-2 gap-1 shadow-sm">
            <Check className="size-3" /> {activeLabel}
          </Badge>
        )}
      </div>
      <CardContent className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title}</p>
            {subtitle && <p className="text-muted-foreground truncate text-xs">{subtitle}</p>}
          </div>
          {stars !== undefined && (
            <Badge variant="outline" className="shrink-0 gap-1 text-xs">
              <Star className="size-3" /> {stars}
            </Badge>
          )}
        </div>
        {children}
        {footer && <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">{footer}</div>}
      </CardContent>
    </Card>
  );
}

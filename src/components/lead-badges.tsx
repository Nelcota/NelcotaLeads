import { scoreTier, type ScoreTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export const TIER_TEXT: Record<ScoreTier, string> = {
  high: "text-tier-high",
  medium: "text-foreground",
  low: "text-muted-foreground",
};

export function ScoreBadge({
  score,
  pending,
  className,
}: {
  score: number | null;
  pending?: boolean;
  className?: string;
}) {
  if (score === null) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>{pending ? "…" : "–"}</span>
    );
  }
  return (
    <span className={cn("font-medium tabular-nums", TIER_TEXT[scoreTier(score)], className)}>
      {score}
    </span>
  );
}

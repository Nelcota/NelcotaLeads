import type { LeadStatus } from "@/db/schema";
import { LEAD_STATUS_LABELS, scoreTier, type ScoreTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export const TIER_TEXT: Record<ScoreTier, string> = {
  high: "text-tier-high",
  medium: "text-tier-medium",
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
      <span className={cn("text-xs text-muted-foreground", className)}>
        {pending ? "em análise" : "–"}
      </span>
    );
  }
  return (
    <span className={cn("font-medium tabular-nums", TIER_TEXT[scoreTier(score)], className)}>
      {score}
    </span>
  );
}

export const STATUS_DOT: Record<LeadStatus, string> = {
  new: "bg-muted-foreground/40",
  contacted: "bg-sky-500",
  replied: "bg-amber-500",
  closed: "bg-emerald-500",
  discarded: "bg-muted-foreground/25",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        status === "discarded" && "text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}

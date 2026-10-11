import type { LeadStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_LABELS } from "@/lib/schemas";
import { cn } from "@/lib/utils";

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
        {pending ? "analisando…" : "—"}
      </span>
    );
  }
  const tone =
    score >= 70
      ? "bg-brand/12 text-brand ring-brand/25"
      : score >= 40
        ? "bg-warning/15 text-foreground ring-warning/30"
        : "bg-muted text-muted-foreground ring-border";
  return (
    <span
      className={cn(
        "inline-flex min-w-9 justify-center rounded-md px-1.5 py-0.5 text-sm font-medium tabular-nums ring-1 ring-inset",
        tone,
        className,
      )}
    >
      {score}
    </span>
  );
}

const STATUS_VARIANT: Record<LeadStatus, "default" | "secondary" | "outline" | "destructive"> = {
  new: "outline",
  contacted: "secondary",
  replied: "default",
  closed: "default",
  discarded: "outline",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      className={cn(status === "discarded" && "text-muted-foreground line-through")}
    >
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}

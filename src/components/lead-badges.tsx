import type { LeadStatus } from "@/db/schema";
import { LEAD_STATUS_LABELS, scoreTier, type ScoreTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const TIER_STROKE: Record<ScoreTier, string> = {
  high: "stroke-tier-high",
  medium: "stroke-tier-medium",
  low: "stroke-tier-low",
};

/** Circular 0–100 gauge colored by score band. */
export function ScoreRing({
  score,
  size = 22,
  stroke = 3,
  showValue = false,
  className,
}: {
  score: number;
  size?: number;
  stroke?: number;
  showValue?: boolean;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Nota ${score} de 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(TIER_STROKE[scoreTier(score)], "transition-[stroke-dashoffset]")}
        />
      </svg>
      {showValue ? (
        <span className="absolute inset-0 grid place-items-center font-medium tabular-nums">
          {score}
        </span>
      ) : null}
    </span>
  );
}

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
      <span
        className={cn("inline-flex items-center gap-2 text-xs text-muted-foreground", className)}
      >
        {pending ? (
          <>
            <span className="size-[18px] animate-spin rounded-full border-2 border-muted border-t-foreground/50" />
            analisando
          </>
        ) : (
          "—"
        )}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-2 tabular-nums", className)}>
      <ScoreRing score={score} size={20} stroke={2.5} />
      <span className="w-6 font-medium">{score}</span>
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
        "inline-flex items-center gap-1.5 text-sm whitespace-nowrap",
        status === "discarded" && "text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}

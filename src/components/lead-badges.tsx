import { Badge } from "@/components/ui/badge";
import type { LeadStatus, SearchStatus } from "@/db/schema";
import { LEAD_STATUS_LABELS, scoreTier, type ScoreTier } from "@/lib/schemas";

const TIER_VARIANT: Record<ScoreTier, "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

/** Score as a badge: solid for high, gray for medium, outlined for low. */
export function ScoreBadge({ score, pending }: { score: number | null; pending?: boolean }) {
  if (score === null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {pending ? "analisando" : "sem nota"}
      </Badge>
    );
  }
  return (
    <Badge variant={TIER_VARIANT[scoreTier(score)]} className="tabular-nums">
      {score}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge variant="outline">{LEAD_STATUS_LABELS[status]}</Badge>;
}

const SEARCH_LABELS: Record<SearchStatus, string> = {
  collecting: "Coletando",
  analyzing: "Analisando",
  done: "Concluída",
  error: "Falhou",
};

export function SearchStatusBadge({ status }: { status: SearchStatus }) {
  return (
    <Badge
      variant={status === "error" ? "destructive" : status === "done" ? "outline" : "secondary"}
    >
      {SEARCH_LABELS[status]}
    </Badge>
  );
}

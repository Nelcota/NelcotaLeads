import { CheckIcon, SparklesIcon, XIcon } from "lucide-react";
import { ProgressRing, TONE_TEXT, type Tone } from "@/components/apple-ui";
import { Badge } from "@/components/ui/badge";
import type { LeadStatus, SearchStatus } from "@/db/schema";
import { dayDiff } from "@/lib/format";
import { LEAD_STATUS_LABELS, scoreTier, type ScoreTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export const TIER_TONE: Record<ScoreTier, Tone> = {
  high: "green",
  medium: "orange",
  low: "gray",
};

export const STATUS_TONE: Record<LeadStatus, Tone> = {
  new: "blue",
  contacted: "gray",
  replied: "orange",
  closed: "green",
  discarded: "red",
};

/** Overdue follow-ups in red, today's in orange, later ones neutral. */
export function followUpTone(day: string, today: string): Tone {
  const diff = dayDiff(today, day);
  return diff < 0 ? "red" : diff === 0 ? "orange" : "gray";
}

/** Score as a small ring in the tier color, with the number next to it. */
export function ScoreBadge({ score, pending }: { score: number | null; pending?: boolean }) {
  if (score === null) {
    return pending ? (
      <Badge variant="purple">
        <SparklesIcon />
        analisando
      </Badge>
    ) : (
      <Badge variant="gray">sem nota</Badge>
    );
  }
  const tone = TIER_TONE[scoreTier(score)];
  return (
    <span
      className={cn("inline-flex items-center gap-2 font-medium tabular-nums", TONE_TEXT[tone])}
    >
      <ProgressRing value={score} tone={tone} size={22} thickness={3} />
      {score}
    </span>
  );
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={STATUS_TONE[status]} dot>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}

const SEARCH_LABELS: Record<SearchStatus, string> = {
  collecting: "Coletando",
  analyzing: "Analisando",
  done: "Concluída",
  error: "Falhou",
  cancelled: "Cancelada",
};

export function SearchStatusBadge({ status }: { status: SearchStatus }) {
  if (status === "done") {
    return (
      <Badge variant="green">
        <CheckIcon />
        {SEARCH_LABELS[status]}
      </Badge>
    );
  }
  if (status === "cancelled") {
    return <Badge variant="gray">{SEARCH_LABELS[status]}</Badge>;
  }
  if (status === "error") {
    return (
      <Badge variant="red">
        <XIcon />
        {SEARCH_LABELS[status]}
      </Badge>
    );
  }
  return (
    <Badge variant={status === "collecting" ? "blue" : "purple"} dot>
      {SEARCH_LABELS[status]}
    </Badge>
  );
}

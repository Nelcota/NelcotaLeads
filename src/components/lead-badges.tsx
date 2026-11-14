import { CheckIcon, SparklesIcon, XIcon } from "@/components/icons";
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

/**
 * Status text a step darker in light mode and lighter in dark: the tone mixed with 20% of
 * `--foreground` keeps the capsule at 4.5:1 or more in both themes (the pure tone falls short).
 */
const SEARCH_TEXT = {
  green: "text-[color-mix(in_srgb,var(--green)_80%,var(--foreground))]",
  red: "text-[color-mix(in_srgb,var(--red)_80%,var(--foreground))]",
  blue: "text-[color-mix(in_srgb,var(--blue)_80%,var(--foreground))]",
  purple: "text-[color-mix(in_srgb,var(--purple)_80%,var(--foreground))]",
  gray: "text-[color-mix(in_srgb,var(--gray)_80%,var(--foreground))]",
} as const;

export function SearchStatusBadge({ status }: { status: SearchStatus }) {
  if (status === "done") {
    return (
      <Badge variant="green" className={SEARCH_TEXT.green}>
        <CheckIcon />
        {SEARCH_LABELS[status]}
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge variant="gray" className={SEARCH_TEXT.gray}>
        {SEARCH_LABELS[status]}
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="red" className={SEARCH_TEXT.red}>
        <XIcon />
        {SEARCH_LABELS[status]}
      </Badge>
    );
  }
  const tone = status === "collecting" ? "blue" : "purple";
  return (
    <Badge variant={tone} className={SEARCH_TEXT[tone]} dot>
      {SEARCH_LABELS[status]}
    </Badge>
  );
}

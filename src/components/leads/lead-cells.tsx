import { ClockIcon, SendIcon, StarIcon } from "lucide-react";
import { ProgressRing, TONE_TEXT } from "@/components/apple-ui";
import { TIER_TONE } from "@/components/lead-badges";
import type { NextStep } from "@/lib/lead-row";
import { scoreTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** The list's checkboxes: a rounded square, solid blue when checked. */
export const LIST_CHECKBOX = "rounded-[5px] data-checked:bg-primary dark:data-checked:bg-primary";

/** The score ring with its number; its tooltip gives the two main reasons. */
export function ScoreCell({
  score,
  pending,
  reasons,
}: {
  score: number | null;
  pending: boolean;
  reasons?: string;
}) {
  if (pending) {
    // The ring only (the name's line says "Analisando…"), so the column stays narrow.
    return (
      <span
        role="img"
        aria-label="Analisando"
        title="Analisando"
        className="inline-flex items-center"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="shrink-0">
          <circle
            cx="11"
            cy="11"
            r="9.5"
            fill="none"
            stroke="var(--fill)"
            strokeWidth="3"
            strokeDasharray="4 4"
          />
        </svg>
      </span>
    );
  }
  if (score === null) return <span className="text-tertiary">sem nota</span>;
  const tone = TIER_TONE[scoreTier(score)];
  return (
    <span
      title={reasons}
      aria-label={reasons}
      className={cn("inline-flex items-center gap-2 font-medium tabular-nums", TONE_TEXT[tone])}
    >
      <ProgressRing value={score} tone={tone} size={22} thickness={3} />
      {score}
    </span>
  );
}

/** "Próximo passo": a clock in the step's color and its text (red when overdue). */
export function NextStepCell({ step }: { step: NextStep | null }) {
  if (!step) return <span className="text-tertiary">—</span>;
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1.5 font-medium"
      style={{ color: step.color ?? "var(--muted-foreground)" }}
    >
      <ClockIcon className="size-3.5 shrink-0" strokeWidth={1.9} />
      <span className="truncate">{step.text}</span>
    </span>
  );
}

/** The owner's photo or initial; a dashed circle while the lead is free. */
export function OwnerCell({ name, avatar }: { name: string | null; avatar: string | null }) {
  if (!name) {
    return (
      <span
        role="img"
        aria-label="Livre"
        title="Livre"
        className="inline-block size-6 rounded-full border-[1.5px] border-dashed border-muted-foreground/45"
      />
    );
  }
  if (avatar) {
    return (
      <img
        src={avatar}
        alt={`Responsável: ${name}`}
        title={name}
        className="size-6 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`Responsável: ${name}`}
      title={name}
      className="inline-grid size-6 place-items-center rounded-full bg-fill text-[11px] font-bold text-foreground"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Google stars and the number of reviews. */
export function RatingCell({ rating, reviews }: { rating: number | null; reviews: number | null }) {
  if (rating === null) return <span className="text-tertiary">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-foreground tabular-nums">
      <StarIcon className="size-3 fill-yellow text-yellow" />
      {rating.toFixed(1).replace(".", ",")}
      <span className="text-tertiary">({reviews ?? 0})</span>
    </span>
  );
}

/** The paper plane next to a lead ready for the first e-mail. */
export function ReadyMark() {
  return (
    <span
      role="img"
      aria-label="Pronto para disparo"
      title="Pronto para disparo"
      className="text-blue"
    >
      <SendIcon className="size-3.5" strokeWidth={1.9} />
    </span>
  );
}

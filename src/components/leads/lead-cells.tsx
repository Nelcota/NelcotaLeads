import { ClockIcon, StarIcon } from "@/components/icons";
import { Hint, ProgressRing, TONE_TEXT } from "@/components/apple-ui";
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
      <Hint label="Analisando">
        <span role="img" aria-label="Analisando" className="inline-flex items-center">
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
      </Hint>
    );
  }
  if (score === null) return <span className="text-tertiary">sem nota</span>;
  const tone = TIER_TONE[scoreTier(score)];
  const cell = (
    <span
      role="img"
      aria-label={reasons ?? `Nota ${score}`}
      className={cn("inline-flex items-center gap-2 font-medium tabular-nums", TONE_TEXT[tone])}
    >
      <ProgressRing value={score} tone={tone} size={22} thickness={3} />
      {score}
    </span>
  );
  // The app's tooltip, not the browser's `title`: same look, keyboard and touch included.
  return reasons ? <Hint label={reasons}>{cell}</Hint> : cell;
}

/** "Próximo passo": a clock in the step's color and its text (red when overdue). */
export function NextStepCell({ step }: { step: NextStep | null }) {
  if (!step) return <span className="text-tertiary">—</span>;
  return (
    <span
      className="inline-flex min-w-0 items-center gap-1.5 font-medium"
      style={{ color: step.color ?? "var(--muted-foreground)" }}
    >
      <ClockIcon className="size-3.5 shrink-0" />
      <span className="truncate">{step.text}</span>
    </span>
  );
}

/** The owner's photo or initial; a dashed circle while the lead is free. */
export function OwnerCell({ name, avatar }: { name: string | null; avatar: string | null }) {
  if (!name) {
    return (
      <Hint label="Livre">
        <span
          role="img"
          aria-label="Livre"
          className="inline-block size-6 rounded-full border-[1.5px] border-dashed border-muted-foreground/45"
        />
      </Hint>
    );
  }
  if (avatar) {
    return (
      <Hint label={name}>
        <img
          src={avatar}
          alt={`Responsável: ${name}`}
          className="size-6 rounded-full object-cover"
        />
      </Hint>
    );
  }
  return (
    <Hint label={name}>
      <span
        role="img"
        aria-label={`Responsável: ${name}`}
        className="inline-grid size-6 place-items-center rounded-full bg-fill text-2xs font-bold text-foreground"
      >
        {name.trim().charAt(0).toUpperCase()}
      </span>
    </Hint>
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

/** "Pronto" in text next to a lead ready for the first e-mail; the paper plane only means sending. */
export function ReadyMark() {
  return (
    <span className="text-xs font-medium text-muted-foreground">
      Pronto<span className="sr-only"> para disparo</span>
    </span>
  );
}

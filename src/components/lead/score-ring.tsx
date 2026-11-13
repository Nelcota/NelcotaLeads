import { ProgressRing, TONE_TEXT } from "@/components/apple-ui";
import { TIER_TONE } from "@/components/lead-badges";
import { Badge } from "@/components/ui/badge";
import { scoreLabel, scoreLevel } from "@/lib/score-label";
import { cn } from "@/lib/utils";

/**
 * The score as a ring with the number inside, like the Leads table, and its level under it
 * ("Nota alta", "Nota média", "Nota baixa"). How it
 * was calculated lives in the Análise card ("Como a nota foi calculada"), not in a tooltip.
 */
export function ScoreRing({ score, pending }: { score: number | null; pending: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <ScoreValue score={score} pending={pending} />
    </div>
  );
}

function ScoreValue({ score, pending }: { score: number | null; pending: boolean }) {
  if (score === null) {
    return pending ? (
      <span className="grid justify-items-center gap-1 text-xs font-medium text-muted-foreground">
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
          <circle
            cx="22"
            cy="22"
            r="19"
            fill="none"
            stroke="var(--fill)"
            strokeWidth="5"
            strokeDasharray="6 6"
          />
        </svg>
        Analisando
      </span>
    ) : (
      <Badge variant="gray">sem nota</Badge>
    );
  }
  const tone = TIER_TONE[scoreLevel(score)];
  return (
    <span className="grid justify-items-center gap-1">
      <ProgressRing
        value={score}
        tone={tone}
        size={52}
        thickness={4}
        track="var(--popover)"
        className="cursor-default"
      >
        <b
          title={`Nota ${score} de 100`}
          className={cn("text-base leading-none font-semibold tabular-nums", TONE_TEXT[tone])}
        >
          {score}
        </b>
      </ProgressRing>
      <small className="text-xs font-medium text-muted-foreground">
        Nota {scoreLabel(score).toLowerCase()}
      </small>
    </span>
  );
}

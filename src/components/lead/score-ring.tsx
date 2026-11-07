import { InfoTip, ProgressRing, TONE_TEXT } from "@/components/apple-ui";
import { TIER_TONE } from "@/components/lead-badges";
import { Badge } from "@/components/ui/badge";
import { SCORE_LABEL_HELP, scoreLabel, scoreLevel } from "@/lib/score-label";
import { cn } from "@/lib/utils";

/** The score as a word ("Alta", "Média", "Baixa") inside a ring, "Nota" under it, and its help. */
export function ScoreRing({ score, pending }: { score: number | null; pending: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <ScoreValue score={score} pending={pending} />
      <InfoTip side="bottom">{SCORE_LABEL_HELP}</InfoTip>
    </div>
  );
}

function ScoreValue({ score, pending }: { score: number | null; pending: boolean }) {
  if (score === null) {
    return pending ? (
      <span className="grid justify-items-center gap-1 text-[12px] font-medium text-muted-foreground">
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
    <ProgressRing
      value={score}
      tone={tone}
      size={60}
      thickness={5}
      track="var(--popover)"
      className="cursor-default"
    >
      <span
        title={`Nota ${score} de 100`}
        className={cn("grid justify-items-center leading-none", TONE_TEXT[tone])}
      >
        <b className="text-[16px] font-semibold">{scoreLabel(score)}</b>
        <small className="mt-0.5 text-[12px] font-medium text-muted-foreground">Nota</small>
      </span>
    </ProgressRing>
  );
}

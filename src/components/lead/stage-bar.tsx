import { CheckIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ChoicePill } from "@/components/ui/choice-pill";
import { STAGE_STEPS, stageOfStep } from "@/lib/lead-stage";
import type { SalesStage } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * Where the lead is in the sale: Novo · Contatado · Respondeu · Reunião · Proposta · Fechado,
 * as compact pills. The current step is the selected (blue) pill and reached steps carry a
 * check. With `onSelectStage` (a replied lead) the Respondeu, Reunião and Proposta steps are
 * buttons; the other steps are plain text, and only the current one keeps the pill.
 */
export function StageBar({
  current,
  busy,
  onSelectStage,
}: {
  current: number;
  busy?: boolean;
  onSelectStage?: (stage: SalesStage | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span id="lead-stage-label" className="text-[13px] font-medium text-muted-foreground">
        Etapa
      </span>
      <ol aria-labelledby="lead-stage-label" className="flex flex-wrap gap-1.5">
        {STAGE_STEPS.map((label, index) => {
          const stage = stageOfStep(index);
          const selectable = onSelectStage && stage !== undefined && index !== current;
          return (
            <li key={label} aria-current={index === current ? "step" : undefined}>
              <StageStep
                label={label}
                reached={index < current}
                current={index === current}
                busy={busy}
                onSelect={selectable ? () => onSelectStage(stage) : undefined}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StageStep({
  label,
  reached,
  current,
  busy,
  onSelect,
}: {
  label: string;
  reached: boolean;
  current: boolean;
  busy?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      {reached ? <CheckIcon className="text-green" strokeWidth={2} /> : null}
      {label}
    </>
  );
  if (onSelect) {
    return (
      <ChoicePill
        size="sm"
        selected={current}
        disabled={busy}
        aria-label={`Mover para ${label}`}
        onClick={onSelect}
      >
        {body}
      </ChoicePill>
    );
  }
  // The current step keeps the blue pill so the lead's place is clear.
  if (current) {
    return (
      <span className={cn(buttonVariants({ size: "sm" }), "pointer-events-none")}>{body}</span>
    );
  }
  // Not a button: plain text with no outline, so it never looks clickable.
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 px-1.5 text-sm font-medium [&_svg]:size-3.5",
        !reached && "text-muted-foreground",
      )}
    >
      {body}
    </span>
  );
}

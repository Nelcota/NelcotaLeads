import { STAGE_STEPS, stageOfStep } from "@/lib/lead-stage";
import type { SalesStage } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/**
 * Where the lead is in the sale: Novo · Contatado · Respondeu · Reunião · Proposta · Fechado.
 * Reached steps are filled, the current one is in the accent color. With `onSelectStage` (a
 * replied lead) the Respondeu, Reunião and Proposta steps are buttons.
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
    <ol aria-label="Etapa do lead" className="grid grid-cols-6 gap-1">
      {STAGE_STEPS.map((label, index) => {
        const stage = stageOfStep(index);
        const selectable = onSelectStage && stage !== undefined && index !== current;
        return (
          <StageStep
            key={label}
            label={label}
            state={index < current ? "reached" : index === current ? "current" : "ahead"}
            busy={busy}
            onSelect={selectable ? () => onSelectStage(stage) : undefined}
          />
        );
      })}
    </ol>
  );
}

type StepState = "reached" | "current" | "ahead";

function StageStep({
  label,
  state,
  busy,
  onSelect,
}: {
  label: string;
  state: StepState;
  busy?: boolean;
  onSelect?: () => void;
}) {
  const body = (
    <>
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-full rounded-full",
          state === "current" ? "bg-primary" : state === "reached" ? "bg-primary/45" : "bg-fill-2",
        )}
      />
      <span
        className={cn(
          "truncate text-[12px]",
          state === "current" ? "font-semibold text-blue" : "font-medium text-muted-foreground",
          state === "ahead" && "text-tertiary",
        )}
      >
        {label}
      </span>
    </>
  );
  const className = "grid w-full justify-items-center gap-1.5 rounded-md py-1";
  return (
    <li aria-current={state === "current" ? "step" : undefined} className="min-w-0">
      {onSelect ? (
        <button
          type="button"
          disabled={busy}
          title={`Mover para ${label}`}
          onClick={onSelect}
          className={cn(
            className,
            "transition-colors outline-none hover:bg-fill-2 focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
          )}
        >
          {body}
        </button>
      ) : (
        <div className={className}>{body}</div>
      )}
    </li>
  );
}

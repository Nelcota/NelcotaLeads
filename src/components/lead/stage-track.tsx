import { CircleXIcon } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { STAGE_ICONS } from "@/components/leads/stage-label";
import { STAGE_COLORS, type LeadStage } from "@/lib/lead-row";
import { STAGE_STEPS, stageOfStep } from "@/lib/lead-stage";
import type { SalesStage } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** The stage of each step of the track, in the order of STAGE_STEPS. */
const STEP_STAGES: readonly LeadStage[] = [
  "new",
  "contacted",
  "replied",
  "meeting",
  "proposal",
  "closed",
];

const LAST_STEP = STAGE_STEPS.length - 1;

/**
 * Where the lead is in the sale, as one continuous track: Novo · Contatado · Respondeu · Reunião ·
 * Proposta · Fechado. The line fills up to the current step in that stage's color; a lead that
 * ended without a deal (`lost`) keeps a grey line and a red node on the step where it stopped.
 * With `onSelectStage` (a replied lead) the Respondeu, Reunião and Proposta steps are buttons;
 * the other steps change through their own actions and are plain text.
 */
export function StageTrack({
  current,
  lost = false,
  busy,
  onSelectStage,
}: {
  current: number;
  lost?: boolean;
  busy?: boolean;
  onSelectStage?: (stage: SalesStage | null) => void;
}) {
  const currentStage = STEP_STAGES[current] ?? "new";
  const fill = lost ? "var(--gray)" : STAGE_COLORS[currentStage];
  const scroller = useScrollToStep(current);
  return (
    // On a phone the six steps keep their width and the track scrolls sideways.
    <div ref={scroller} className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none]">
      <div className="relative min-w-[480px] sm:min-w-0">
        <div
          aria-hidden
          className="absolute top-[15px] right-[calc(100%/12)] left-[calc(100%/12)] h-0.5 rounded-full bg-fill"
        >
          <div
            className="h-full rounded-full transition-[width,background-color] duration-700 ease-spring motion-reduce:transition-none"
            style={{ width: `${(current / LAST_STEP) * 100}%`, background: fill }}
          />
        </div>
        <ol aria-label="Etapa" className="relative grid grid-cols-6">
          {STAGE_STEPS.map((label, index) => {
            const stage = stageOfStep(index);
            const selectable = onSelectStage && stage !== undefined && index !== current;
            return (
              <li key={label} aria-current={index === current ? "step" : undefined}>
                <StageStep
                  label={label}
                  stage={STEP_STAGES[index] ?? "new"}
                  state={stepState(index, current, lost)}
                  busy={busy}
                  onSelect={selectable ? () => onSelectStage(stage) : undefined}
                />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/**
 * On a phone the track scrolls sideways; this keeps the current step in view, centered when it
 * can be, without moving the page itself.
 */
function useScrollToStep(current: number) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scroller.current;
    if (!container) return;
    if (container.scrollWidth <= container.clientWidth) return;
    const step = container.querySelectorAll<HTMLElement>("li")[current];
    if (!step) return;
    container.scrollLeft = step.offsetLeft - (container.clientWidth - step.offsetWidth) / 2;
  }, [current]);
  return scroller;
}

type StepState = "current" | "reached" | "ahead" | "lost" | "before-lost";

function stepState(index: number, current: number, lost: boolean): StepState {
  if (index === current) return lost ? "lost" : "current";
  if (index > current) return "ahead";
  return lost ? "before-lost" : "reached";
}

/** The node and text color of each state; the stage color comes in through `--tone`. */
const NODE_STATE: Record<StepState, string> = {
  current: "border-2 border-(--tone) text-(--tone)",
  reached: "border-(--tone) text-(--tone)",
  ahead: "border-border text-muted-foreground",
  lost: "border-2 border-red text-red",
  "before-lost": "border-gray text-gray",
};

const LABEL_STATE: Record<StepState, string> = {
  current: "font-semibold text-foreground",
  reached: "text-foreground",
  ahead: "text-muted-foreground",
  lost: "font-semibold text-foreground",
  "before-lost": "text-foreground",
};

function StageStep({
  label,
  stage,
  state,
  busy,
  onSelect,
}: {
  label: string;
  stage: LeadStage;
  state: StepState;
  busy?: boolean;
  onSelect?: () => void;
}) {
  const Icon = state === "lost" ? CircleXIcon : STAGE_ICONS[stage];
  const body: ReactNode = (
    <>
      <span
        // Remounts when the step becomes the current one, so the pop plays on every change.
        key={state}
        className={cn(
          "relative grid size-8 place-items-center rounded-full border-[1.5px] bg-card transition-colors duration-300",
          NODE_STATE[state],
          state === "current" && "stage-node-pop",
        )}
      >
        <Icon className="size-3.5" strokeWidth={1.9} />
        {state === "current" ? (
          <span
            aria-hidden
            className="stage-ring absolute -inset-[5px] rounded-full border-[1.5px] border-(--tone) opacity-0"
          />
        ) : null}
      </span>
      <span className={cn("text-sm font-medium whitespace-nowrap", LABEL_STATE[state])}>
        {label}
      </span>
    </>
  );
  const layout = "grid w-full justify-items-center gap-1.5 px-0.5";
  const tone = { "--tone": STAGE_COLORS[stage] } as CSSProperties;
  if (!onSelect) {
    return (
      <span className={layout} style={tone}>
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Mover para ${label}`}
      onClick={onSelect}
      style={tone}
      className={cn(
        layout,
        "cursor-pointer rounded-[14px] py-1 -my-1 outline-hidden transition-colors hover:bg-fill-2 focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50 pointer-coarse:min-h-11",
      )}
    >
      {body}
    </button>
  );
}

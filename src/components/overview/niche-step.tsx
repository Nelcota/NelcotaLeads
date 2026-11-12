import type { NicheStep as NicheStepData, NicheStepTone } from "@/lib/niche-metrics";
import { cn } from "@/lib/utils";

const BAR_CLASS: Record<NicheStepTone, string> = {
  primary: "bg-primary",
  blue: "bg-blue",
  green: "bg-green",
  red: "bg-red",
};

/** "40%"; "–" when the share has no base; nothing on the contacted row, the base itself. */
function percentText(step: NicheStepData): string {
  if (step.isBase) return "";
  if (step.percent === null) return "–";
  return `${step.percent}%`;
}

const VALUE_CLASS: Record<NicheStepTone, string> = {
  primary: "text-foreground",
  blue: "text-blue",
  green: "text-green",
  red: "text-red",
};

/** One funnel row of a niche card: label, bar, count and share in fixed columns. */
export function NicheStep({ step }: { step: NicheStepData }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)_40px_40px] items-center gap-x-3">
      <span className="text-sm text-muted-foreground">{step.label}</span>
      <span className="h-1.5 overflow-hidden rounded-full bg-fill-2">
        <span
          className={cn("block h-full rounded-full", BAR_CLASS[step.tone])}
          style={{ width: `${step.width}%` }}
        />
      </span>
      <span
        className={cn(
          "text-right font-semibold tabular-nums",
          step.value === 0 ? "text-tertiary" : VALUE_CLASS[step.tone],
        )}
      >
        {step.value}
      </span>
      <span className="text-right text-xs text-tertiary tabular-nums">{percentText(step)}</span>
    </div>
  );
}

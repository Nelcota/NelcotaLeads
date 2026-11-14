import { CircleXIcon, PencilIcon, RefreshCwIcon } from "lucide-react";
import type { Lead } from "@/db/schema";
import type { HistoryEvent } from "@/lib/lead-history";
import { currentStageStep, STAGE_STEPS } from "@/lib/lead-stage";
import { LOSS_REASON_LABELS, type SalesStage } from "@/lib/schemas";
import { lostStageStep, stageReason } from "@/lib/stage-track";
import { StageTrack } from "./stage-track";

/**
 * The stage track under the quick actions, with one line under it saying what moved the lead
 * there (the system or the AI on its own, or a person). A lead that ended without a deal keeps
 * the track, stopped on the step where it was lost, with the reason when one was recorded.
 */
export function LeadStage({
  lead,
  events,
  busy,
  onSelectStage,
}: {
  lead: Pick<Lead, "status" | "salesStage" | "lossReason">;
  events: readonly HistoryEvent[];
  busy: boolean;
  onSelectStage: (stage: SalesStage | null) => void;
}) {
  const current = currentStageStep(lead.status, lead.salesStage);
  if (current === null) {
    const step = lostStageStep(events, lead.salesStage);
    return (
      <div className="grid gap-3">
        <StageTrack current={step} lost />
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <CircleXIcon aria-hidden className="size-3.5 shrink-0 text-red" strokeWidth={1.9} />
          {lostText(step, lead.lossReason)}
        </p>
      </div>
    );
  }
  const reason = stageReason(events);
  return (
    <div className="grid gap-3">
      <StageTrack
        current={current}
        busy={busy}
        onSelectStage={lead.status === "replied" ? onSelectStage : undefined}
      />
      {reason ? (
        <p
          aria-live="polite"
          className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
        >
          {reason.auto ? (
            <RefreshCwIcon aria-hidden className="size-3.5 shrink-0 text-green" strokeWidth={1.9} />
          ) : (
            <PencilIcon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.9} />
          )}
          {reason.text}
        </p>
      ) : null}
    </div>
  );
}

/** "Perdido em Proposta · Preço alto", or "Descartado em Contatado" without a loss reason. */
function lostText(step: number, lossReason: Lead["lossReason"]): string {
  const where = STAGE_STEPS[step] ?? STAGE_STEPS[0];
  if (!lossReason) return `Descartado em ${where}`;
  return `Perdido em ${where} · ${LOSS_REASON_LABELS[lossReason]}`;
}

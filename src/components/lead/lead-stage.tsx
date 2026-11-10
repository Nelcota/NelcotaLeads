import type { Lead } from "@/db/schema";
import { currentStageStep } from "@/lib/lead-stage";
import { LOSS_REASON_LABELS, type SalesStage } from "@/lib/schemas";
import { StageBar } from "./stage-bar";

/**
 * The stage bar under the quick actions; a lead that ended without a deal has no place on it
 * and says so instead, with the reason when one was recorded.
 */
export function LeadStage({
  lead,
  busy,
  onSelectStage,
}: {
  lead: Pick<Lead, "status" | "salesStage" | "lossReason">;
  busy: boolean;
  onSelectStage: (stage: SalesStage | null) => void;
}) {
  const current = currentStageStep(lead.status, lead.salesStage);
  if (current === null) {
    return (
      <p className="rounded-[14px] border border-foreground/15 px-3.5 py-2.5 text-sm font-medium">
        Encerrado sem negócio
        {lead.lossReason ? (
          <span className="font-normal"> · {LOSS_REASON_LABELS[lead.lossReason]}</span>
        ) : null}
      </p>
    );
  }
  return (
    <StageBar
      current={current}
      busy={busy}
      onSelectStage={lead.status === "replied" ? onSelectStage : undefined}
    />
  );
}

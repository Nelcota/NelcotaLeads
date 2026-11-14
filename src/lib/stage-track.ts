import type { LeadStatus } from "@/db/schema";
import { eventText, eventTime, type HistoryEvent } from "@/lib/lead-history";
import { currentStageStep } from "@/lib/lead-stage";
import { LEAD_STATUS_VALUES, type SalesStage } from "@/lib/schemas";

/** Why the lead is in its stage: the text under the stage track, and whether a person did it. */
export type StageReason = { auto: boolean; text: string };

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * The newest thing that moved the lead (status, stage, deal, meeting or proposal; taking the
 * lead is not a move). An event without a person was written by the system or the AI.
 * `events` come newest first, as the lead query returns them.
 */
export function stageReason(events: readonly HistoryEvent[]): StageReason | null {
  const event = events.find((item) => item.kind !== "owner");
  if (!event) return null;
  const when = eventTime(event.createdAt);
  if (!event.userName) {
    return { auto: true, text: `Atualizada sozinha: ${lowerFirst(eventText(event))} em ${when}` };
  }
  return { auto: false, text: `${eventText(event)} por ${event.userName} em ${when}` };
}

/**
 * The step of the track where a lead that ended without a deal stopped: the status it had right
 * before it was discarded (with the sale stage it kept), or the first step when nothing says.
 */
export function lostStageStep(
  events: readonly HistoryEvent[],
  salesStage: SalesStage | null,
): number {
  const ended = events.find((event) => event.kind === "status" && event.toValue === "discarded");
  const before = LEAD_STATUS_VALUES.find((status: LeadStatus) => status === ended?.fromValue);
  if (!before || before === "discarded") return 0;
  return currentStageStep(before, before === "replied" ? salesStage : null) ?? 0;
}

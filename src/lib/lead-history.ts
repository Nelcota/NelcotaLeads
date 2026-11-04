import type { LeadEventKind, LeadStatus } from "@/db/schema";
import { formatIsoLocal } from "@/lib/format";
import { formatCents } from "@/lib/money";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  LOSS_REASON_LABELS,
  LOSS_REASONS,
  SALES_STAGES,
  type LossReason,
  type SalesStage,
} from "@/lib/schemas";

/** One row of the lead's history, as the lead query returns it. */
export type HistoryEvent = {
  id: string;
  kind: LeadEventKind;
  fromValue: string | null;
  toValue: string | null;
  userName: string | null;
  createdAt: Date;
};

export type HistoryLine = { id: string; text: string; meta: string };

const STAGE_LABELS: Record<SalesStage, string> = { meeting: "Reunião", proposal: "Proposta" };
const ENDED: readonly LeadStatus[] = ["closed", "discarded"];

const asStatus = (value: string | null) => LEAD_STATUS_VALUES.find((status) => status === value);
const asStage = (value: string | null) => SALES_STAGES.find((stage) => stage === value);
const asLossReason = (value: string | null): LossReason | undefined =>
  LOSS_REASONS.find((reason) => reason === value);

/** "03/11 14:05" in Brazil time. */
export function eventTime(date: Date): string {
  const iso = formatIsoLocal(date);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
}

function statusText(fromValue: string | null, toValue: string | null): string {
  const to = asStatus(toValue);
  if (!to) return "Status alterado";
  const from = asStatus(fromValue);
  if (from && ENDED.includes(from) && !ENDED.includes(to)) {
    return `Reaberto em ${LEAD_STATUS_LABELS[to]}`;
  }
  return `Passou para ${LEAD_STATUS_LABELS[to]}`;
}

function stageText(fromValue: string | null, toValue: string | null): string {
  const to = asStage(toValue);
  if (to) return `Passou para ${STAGE_LABELS[to]}`;
  const from = asStage(fromValue);
  return from ? `Saiu de ${STAGE_LABELS[from]}` : "Etapa alterada";
}

function ownerText(toValue: string | null, userName: string | null): string {
  const by = userName ? ` por ${userName}` : "";
  return toValue ? `Assumido${by}` : `Liberado${by}`;
}

function wonText(toValue: string | null): string {
  const cents = Number(toValue);
  return Number.isInteger(cents) && cents > 0 ? `Fechado por ${formatCents(cents)}` : "Fechado";
}

/** Written when a meeting is booked (`to` = when it starts) or cancelled (`to` = "cancelled"). */
export const MEETING_CANCELLED = "cancelled";

function meetingText(toValue: string | null): string {
  if (toValue === MEETING_CANCELLED) return "Reunião cancelada";
  const startsAt = toValue ? new Date(toValue) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) return "Reunião marcada";
  return `Reunião marcada para ${eventTime(startsAt)}`;
}

/**
 * `to` = the proposal's total in cents; `from` = "email" when it was queued to go by e-mail.
 * Written when it is saved, before any send: whether it went out is the e-mail's own status.
 */
function proposalText(fromValue: string | null, toValue: string | null): string {
  const cents = Number(toValue);
  const verb = fromValue === "email" ? "Proposta para envio por e-mail" : "Proposta montada";
  return Number.isInteger(cents) && cents > 0 ? `${verb}: ${formatCents(cents)}` : verb;
}

function lostText(toValue: string | null): string {
  const reason = asLossReason(toValue);
  return reason ? `Encerrado: ${LOSS_REASON_LABELS[reason]}` : "Encerrado sem negócio";
}

const EVENT_TEXT: Record<LeadEventKind, (event: HistoryEvent) => string> = {
  status: (event) => statusText(event.fromValue, event.toValue),
  stage: (event) => stageText(event.fromValue, event.toValue),
  owner: (event) => ownerText(event.toValue, event.userName),
  won: (event) => wonText(event.toValue),
  lost: (event) => lostText(event.toValue),
  meeting: (event) => meetingText(event.toValue),
  proposal: (event) => proposalText(event.fromValue, event.toValue),
};

/** What happened, in words: "Fechado por R$ 1.490", "Encerrado: Preço alto"... */
export function eventText(event: HistoryEvent): string {
  return EVENT_TEXT[event.kind](event);
}

/** A deal won or lost also writes a status event at the same instant; it says the same thing. */
function repeatsOutcome(event: HistoryEvent, events: readonly HistoryEvent[]): boolean {
  if (event.kind !== "status") return false;
  const outcome =
    event.toValue === "closed" ? "won" : event.toValue === "discarded" ? "lost" : null;
  if (!outcome) return false;
  const at = event.createdAt.getTime();
  return events.some((other) => other.kind === outcome && other.createdAt.getTime() === at);
}

/**
 * The history as lines for the panel, newest first as given: the text, then who and when
 * ("Haniel · 03/11 14:05"). An owner line already names the person.
 */
export function historyLines(events: readonly HistoryEvent[]): HistoryLine[] {
  return events
    .filter((event) => !repeatsOutcome(event, events))
    .map((event) => {
      const who = event.kind === "owner" ? null : event.userName;
      const meta = [who, eventTime(event.createdAt)].filter(Boolean).join(" · ");
      return { id: event.id, text: eventText(event), meta };
    });
}

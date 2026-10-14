import type { Lead, LeadStatus } from "@/db/schema";
import { addDays } from "@/lib/format";
import { LEAD_STATUS_LABELS, type UpdateLeadInput } from "@/lib/schemas";

export const DEFAULT_FOLLOW_UP_DAYS = 3;

type Patch = Partial<
  Pick<Lead, "status" | "notes" | "contactedAt" | "followUpOn" | "discardReason" | "discardedAt">
>;

/**
 * Status changes a person can make, mirroring the lead detail actions: contact a new lead,
 * undo the contact, mark a reply, close or give up, reopen a closed conversation and send
 * a discarded lead back to the queue.
 */
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  new: ["contacted", "discarded"],
  contacted: ["new", "replied", "closed", "discarded"],
  replied: ["closed", "discarded"],
  closed: ["replied"],
  discarded: ["new"],
};

/** Statuses that lead to (more) outreach; never allowed once the lead unsubscribed. */
export const OUTREACH_STATUSES: readonly LeadStatus[] = ["new", "contacted", "replied"];

export const UNSUBSCRIBED_MESSAGE =
  "Este lead pediu para não receber contato e não pode voltar para a fila.";

/** Throws a user-facing error when the status change is not allowed. */
export function assertTransition(
  current: Pick<Lead, "status" | "unsubscribedAt">,
  next: LeadStatus | undefined,
) {
  if (next === undefined || next === current.status) return;
  if (current.unsubscribedAt && OUTREACH_STATUSES.includes(next)) {
    throw new Error(UNSUBSCRIBED_MESSAGE);
  }
  if (!LEAD_TRANSITIONS[current.status].includes(next)) {
    throw new Error(
      `Não é possível mudar o lead de "${LEAD_STATUS_LABELS[current.status]}" para "${LEAD_STATUS_LABELS[next]}".`,
    );
  }
}

/**
 * Why a closed conversation cannot be reopened, or null when it can. Reopening moves the lead
 * back to "replied", so it follows LEAD_TRANSITIONS and the opt-out rule.
 */
export function reopenBlocker(lead: Pick<Lead, "status" | "unsubscribedAt">): string | null {
  if (lead.unsubscribedAt) return "Este lead pediu para não receber contato.";
  if (lead.status === "replied" || LEAD_TRANSITIONS[lead.status].includes("replied")) return null;
  return lead.status === "discarded"
    ? "Conversas encerradas sem negócio não podem ser reabertas."
    : "Esta conversa ainda não pode ser reaberta.";
}

/**
 * Turns a lead update into the columns to write. Marking a lead as contacted records
 * when it happened and schedules a follow-up; leaving the pipeline clears the follow-up.
 * Throws when the status change is not allowed (see LEAD_TRANSITIONS), unless the caller
 * ends the conversation itself, which may close or discard a lead from any status.
 */
export function leadPatch(
  current: Pick<Lead, "status" | "unsubscribedAt" | "contactedAt" | "followUpOn">,
  { id: _id, ...changes }: UpdateLeadInput,
  now: Date,
  today: string,
  { anyStatus = false } = {},
): Patch {
  if (!anyStatus) assertTransition(current, changes.status);
  const patch: Patch = { ...changes };
  if (changes.status === "contacted") {
    patch.contactedAt = current.contactedAt ?? now;
    if (changes.followUpOn === undefined && !current.followUpOn) {
      patch.followUpOn = addDays(today, DEFAULT_FOLLOW_UP_DAYS);
    }
  }
  // A person moving the lead overrides the AI's triage.
  if (changes.status && changes.status !== "discarded") {
    patch.discardReason = null;
    patch.discardedAt = null;
  }
  if (
    (changes.status === "new" || changes.status === "closed" || changes.status === "discarded") &&
    changes.followUpOn === undefined
  ) {
    patch.followUpOn = null;
  }
  return patch;
}

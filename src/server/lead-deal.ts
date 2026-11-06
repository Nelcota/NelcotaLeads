import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leadEvents, leads } from "@/db/schema";
import { localDay } from "@/lib/format";
import {
  LEAD_NOT_FOUND,
  LOSS_REASON_LABELS,
  type CloseLostInput,
  type CloseWonInput,
  type OwnerInput,
  type SalesStageInput,
} from "@/lib/schemas";
import { closeConversation } from "./conversation";
import { leadEvent } from "./lead-events";
import { LEAD_CHANGED_MESSAGE } from "./lead-status";

export { LEAD_CHANGED_MESSAGE };

export const FUTURE_CLOSE_MESSAGE = "A data do fechamento não pode ser no futuro.";
export const STAGE_NEEDS_REPLY_MESSAGE = "Reunião e proposta só valem para leads que responderam.";
export const SESSION_EXPIRED_MESSAGE = "Sessão expirada";

/**
 * When a deal closed on `day`: now for today, midday in Brazil for an earlier day (the time of
 * a past close is not known).
 */
export function closedAtFor(day: string, now: Date): Date {
  if (day === localDay(now)) return now;
  return new Date(`${day}T12:00:00-03:00`);
}

/**
 * "Fechar negócio": the lead becomes closed with the value, the day and what was sold, like
 * ending the conversation (pending e-mails are cancelled). Writes the won and status events.
 */
export async function closeWonDeal(
  db: Db,
  { id, valueCents, closedOn, service }: CloseWonInput,
  userId: string | null,
  now = new Date(),
) {
  if (closedOn > localDay(now)) throw new Error(FUTURE_CLOSE_MESSAGE);
  const snapshot = await closeConversation(db, id, "closed", now, {
    userId,
    deal: {
      closedAt: closedAtFor(closedOn, now),
      dealValueCents: valueCents,
      dealService: service,
    },
    events: [leadEvent(id, "won", { to: String(valueCents) }, userId, now)],
  });
  return { ok: true as const, snapshot };
}

/**
 * "Encerrar sem negócio": the lead is discarded with the reason, kept as `discardReason` too so
 * the screens that show it keep working. Writes the lost and status events. "Pediu para não ser
 * contatado" also opts the lead out.
 */
export async function closeLostDeal(
  db: Db,
  { id, reason, note }: CloseLostInput,
  userId: string | null,
  now = new Date(),
) {
  const snapshot = await closeConversation(db, id, "discarded", now, {
    userId,
    deal: {
      lossReason: reason,
      lossNote: note || null,
      lostAt: now,
      discardReason: LOSS_REASON_LABELS[reason],
      discardedAt: now,
      // Asked not to be contacted: an opt-out, so the lead never goes back to the queue and
      // its address is blocked like one that answered "sair".
      ...(reason === "asked_no_contact" ? { unsubscribedAt: now } : {}),
    },
    events: [leadEvent(id, "lost", { to: reason }, userId, now)],
  });
  return { ok: true as const, snapshot };
}

/** Moves a replied lead to a meeting or a proposal (or back to just replied, with null). */
export async function changeSalesStage(
  db: Db,
  { id, stage }: SalesStageInput,
  userId: string | null,
  now = new Date(),
) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, id),
    columns: { status: true, salesStage: true },
  });
  if (!lead) throw new Error(LEAD_NOT_FOUND);
  if (lead.status !== "replied") throw new Error(STAGE_NEEDS_REPLY_MESSAGE);
  if (lead.salesStage === stage) return { ok: true as const };
  // Only applies if nobody moved the lead since it was read.
  const updated = await db
    .update(leads)
    .set({ salesStage: stage })
    .where(
      and(
        eq(leads.id, id),
        eq(leads.status, "replied"),
        lead.salesStage ? eq(leads.salesStage, lead.salesStage) : isNull(leads.salesStage),
      ),
    )
    .returning({ id: leads.id });
  if (updated.length === 0) throw new Error(LEAD_CHANGED_MESSAGE);
  await db
    .insert(leadEvents)
    .values(leadEvent(id, "stage", { from: lead.salesStage, to: stage }, userId, now));
  return { ok: true as const };
}

/** "Assumir" makes the signed-in person the lead's owner; "Liberar" (null) frees it. */
export async function changeOwner(
  db: Db,
  { id, owner }: OwnerInput,
  userId: string | null,
  now = new Date(),
) {
  if (owner === "me" && !userId) throw new Error(SESSION_EXPIRED_MESSAGE);
  const next = owner === "me" ? userId : null;
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, id),
    columns: { ownerId: true },
  });
  if (!lead) throw new Error(LEAD_NOT_FOUND);
  if (lead.ownerId === next) return { ok: true as const };
  // Only applies if nobody took or freed the lead since it was read.
  const updated = await db
    .update(leads)
    .set({ ownerId: next })
    .where(
      and(eq(leads.id, id), lead.ownerId ? eq(leads.ownerId, lead.ownerId) : isNull(leads.ownerId)),
    )
    .returning({ id: leads.id });
  if (updated.length === 0) throw new Error(LEAD_CHANGED_MESSAGE);
  await db
    .insert(leadEvents)
    .values(leadEvent(id, "owner", { from: lead.ownerId, to: next }, userId, now));
  return { ok: true as const };
}

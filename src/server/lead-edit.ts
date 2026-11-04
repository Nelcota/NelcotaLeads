import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { emails, leadEvents, leads } from "@/db/schema";
import { localDay } from "@/lib/format";
import { contactPatch, type ContactField } from "@/lib/lead-contact";
import { LEAD_NOT_FOUND, type UpdateLeadInput } from "@/lib/schemas";
import { LEAD_CHANGED_MESSAGE } from "./lead-deal";
import { WON_NEEDS_DEAL_MESSAGE } from "./conversation";
import { statusEvents } from "./lead-events";
import { leadPatch } from "./lead-status";
import { addressUnsubscribed } from "./mail-flow";
import { cancelFutureMeetings } from "./meeting-store";

export const EMAIL_REMOVED_REASON = "Cancelado: o e-mail do lead foi removido";

export const UNSUBSCRIBED_EMAIL_MESSAGE =
  "Este e-mail pediu para não receber contato e não pode ser usado.";

/**
 * Status, notes or follow-up changed in the lead panel, through the status rules (leadPatch).
 * A status change goes to the history, with who made it.
 */
export async function editLead(
  db: Db,
  data: UpdateLeadInput,
  userId: string | null,
  now = new Date(),
) {
  const current = await db.query.leads.findFirst({
    where: eq(leads.id, data.id),
    columns: { status: true, unsubscribedAt: true, contactedAt: true, followUpOn: true },
  });
  if (!current) throw new Error(LEAD_NOT_FOUND);
  // A won deal carries its value and service: it closes through "Fechar negócio".
  if (data.status === "closed" && current.status !== "closed") {
    throw new Error(WON_NEEDS_DEAL_MESSAGE);
  }
  const patch = leadPatch(current, data, now, localDay(now));
  // Only applies if nobody (e.g. the mail flow) changed the status since it was checked.
  const updated = await db
    .update(leads)
    .set(patch)
    .where(and(eq(leads.id, data.id), eq(leads.status, current.status)))
    .returning({ id: leads.id });
  if (updated.length === 0) throw new Error(LEAD_CHANGED_MESSAGE);
  const events = statusEvents(data.id, current.status, data.status, userId, now);
  if (events.length > 0) await db.insert(leadEvents).values(events);
  // An ended lead has nothing left to meet about.
  if (events.length > 0 && (data.status === "closed" || data.status === "discarded")) {
    await cancelFutureMeetings(db, data.id, now);
  }
  return { ok: true as const };
}

/**
 * Saves one contact field typed in the lead panel. The value is validated the same way as for
 * a new lead, and an address that opted out (on any lead) is refused.
 */
export async function editLeadContact(
  db: Db,
  { id, field, value }: { id: string; field: ContactField; value: string },
) {
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, id),
    columns: { id: true, email: true, website: true },
  });
  if (!lead) throw new Error("Lead não encontrado");
  const patch = contactPatch(field, value);
  if (patch.email && patch.email !== lead.email?.toLowerCase()) {
    if (await addressUnsubscribed(db, patch.email)) throw new Error(UNSUBSCRIBED_EMAIL_MESSAGE);
  }
  // The same site again keeps what was already read from it.
  if (field === "website" && patch.website === lead.website) return { ok: true as const };
  const updateLead = db.update(leads).set(patch).where(eq(leads.id, id));
  const oldAddress = lead.email?.toLowerCase();
  if (field !== "email" || !oldAddress || patch.email === oldAddress) {
    await updateLead;
    return { ok: true as const };
  }
  await db.batch([updateLead, retargetUnsentEmails(db, id, oldAddress, patch.email ?? null)]);
  return { ok: true as const };
}

/**
 * E-mails not sent yet to the lead's old address follow the corrected one; with the address
 * removed they are cancelled instead of going to an address the user took out.
 */
function retargetUnsentEmails(
  db: Db,
  leadId: string,
  oldAddress: string,
  newAddress: string | null,
) {
  const unsent = and(
    eq(emails.leadId, leadId),
    // Older rows may keep the address as it was typed, in any case.
    sql`lower(${emails.toAddress}) = ${oldAddress}`,
    inArray(emails.status, ["draft", "queued"]),
    isNull(emails.sentAt),
  );
  if (newAddress) return db.update(emails).set({ toAddress: newAddress }).where(unsent);
  return db.update(emails).set({ status: "cancelled", error: EMAIL_REMOVED_REASON }).where(unsent);
}

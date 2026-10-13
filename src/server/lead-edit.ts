import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads } from "@/db/schema";
import { contactPatch, type ContactField } from "@/lib/lead-contact";
import { addressUnsubscribed } from "./mail-flow";

export const UNSUBSCRIBED_EMAIL_MESSAGE =
  "Este e-mail pediu para não receber contato e não pode ser usado.";

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
  await db.update(leads).set(patch).where(eq(leads.id, id));
  return { ok: true as const };
}

import { and, eq, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { contactPatch } from "@/lib/lead-contact";
import { MANUAL_SEARCH_ID, MANUAL_SEARCH_NAME } from "@/lib/searches";
import { ENQUEUE_FAILED_MESSAGE } from "./collect";
import { UNSUBSCRIBED_EMAIL_MESSAGE } from "./lead-edit";
import { addressUnsubscribed } from "./mail-flow";
import { enqueueLeads, type LeadJob } from "./queue";

export type ManualLeadInput = {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
};

export const NO_SITE_MESSAGE = "Adicionado à mão, sem site.";

export type ManualLeadResult =
  | { status: "created"; id: string }
  | { status: "duplicate"; id: string; name: string };

/**
 * "Adicionar lead": a lead typed in by the user. It needs a name plus an e-mail or a phone, is
 * matched against the existing leads by e-mail and phone (a match is returned, not created),
 * and goes through the AI analysis like the others only when it has a site; without one it is
 * saved as not analyzed ("Reanalisar" still works).
 */
export async function createManualLead(
  db: Db,
  queue: Queue<LeadJob>,
  input: ManualLeadInput,
): Promise<ManualLeadResult> {
  const name = contactPatch("name", input.name).name ?? input.name;
  const contact = {
    ...contactPatch("email", input.email ?? ""),
    ...contactPatch("phone", input.phone ?? ""),
    ...contactPatch("website", input.website ?? ""),
  };
  if (!contact.email && !contact.phone) {
    throw new Error("Informe um e-mail ou um telefone.");
  }
  if (contact.email && (await addressUnsubscribed(db, contact.email))) {
    throw new Error(UNSUBSCRIBED_EMAIL_MESSAGE);
  }

  const same = [
    contact.email ? sql`lower(${leads.email}) = ${contact.email}` : undefined,
    contact.phoneE164 ? eq(leads.phoneE164, contact.phoneE164) : undefined,
  ].filter((condition) => condition !== undefined);
  const [existing] = await db
    .select({ id: leads.id, name: leads.name })
    .from(leads)
    .where(or(...same))
    .limit(1);
  if (existing) return { status: "duplicate", ...existing };

  const id = crypto.randomUUID();
  const analyze = Boolean(contact.website);
  await db.batch([
    db
      .insert(searches)
      .values({
        id: MANUAL_SEARCH_ID,
        niche: MANUAL_SEARCH_NAME,
        city: "",
        maxResults: 0,
        status: "done",
      })
      .onConflictDoNothing(),
    db.insert(leads).values({
      id,
      searchId: MANUAL_SEARCH_ID,
      // Unique like a Google place id, which a hand-typed lead doesn't have.
      placeId: `manual:${id}`,
      name,
      ...contact,
      analysisStatus: analyze ? "pending" : "skipped",
      analysisError: analyze ? null : NO_SITE_MESSAGE,
    }),
    db
      .update(searches)
      .set({ foundCount: sql`${searches.foundCount} + 1` })
      .where(eq(searches.id, MANUAL_SEARCH_ID)),
  ]);

  if (analyze) {
    try {
      await enqueueLeads(queue, [id]);
    } catch (error) {
      console.error("could not enqueue the manual lead", id, error);
      await db
        .update(leads)
        .set({ analysisStatus: "error", analysisError: ENQUEUE_FAILED_MESSAGE })
        .where(and(eq(leads.id, id), eq(leads.analysisStatus, "pending")));
    }
  }
  return { status: "created", id };
}

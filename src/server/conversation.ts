import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { emails, leads } from "@/db/schema";
import { localDay } from "@/lib/format";
import { idSchema } from "@/lib/schemas";
import { leadPatch, UNSUBSCRIBED_MESSAGE } from "./lead-status";
import { CLOSED_REASON } from "./mail-flow";

/**
 * Actions a person takes on one e-mail conversation. Nothing here deletes what was written:
 * pending e-mails are cancelled (and can come back), so every step can be undone.
 */

/** Matches only the listed ids; an empty list matches nothing. */
function idIn(ids: string[]) {
  return ids.length > 0 ? inArray(emails.id, ids) : sql`0`;
}

export const closeSnapshotSchema = z.object({
  previous: z.object({
    status: z.enum(["new", "contacted", "replied"]),
    aiMode: z.boolean(),
    handoffReason: z.string().max(300).nullable(),
    followUpOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  }),
  cancelledIds: z.object({
    queued: z.array(idSchema).max(200),
    draft: z.array(idSchema).max(200),
  }),
});
export type CloseSnapshot = z.infer<typeof closeSnapshotSchema>;

/**
 * Ends a conversation as won (closed) or lost (discarded). Drafts and queued e-mails not yet
 * picked up by a send are cancelled; the returned snapshot is what `undoCloseConversation`
 * needs to put everything back.
 */
export async function closeConversation(
  db: Db,
  leadId: string,
  outcome: "closed" | "discarded",
  now = new Date(),
): Promise<CloseSnapshot> {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead não encontrado");
  if (lead.status === "closed" || lead.status === "discarded") {
    throw new Error("Esta conversa já está encerrada.");
  }
  // Throws when the lead cannot end this way (e.g. it was never contacted).
  const patch = leadPatch(lead, { id: lead.id, status: outcome }, now, localDay(now));

  const pending = await db
    .select({ id: emails.id, status: emails.status })
    .from(emails)
    .where(
      and(
        eq(emails.leadId, lead.id),
        or(eq(emails.status, "draft"), and(eq(emails.status, "queued"), isNull(emails.sentAt))),
      ),
    );
  const idsOf = (status: string) =>
    pending.filter((row) => row.status === status).map((row) => row.id);
  const cancel = { status: "cancelled" as const, error: CLOSED_REASON };
  const [, drafts, queued] = await db.batch([
    db
      .update(leads)
      .set({ ...patch, aiMode: false, handoffReason: null })
      .where(eq(leads.id, lead.id)),
    db
      .update(emails)
      .set(cancel)
      .where(and(idIn(idsOf("draft")), eq(emails.status, "draft")))
      .returning({ id: emails.id }),
    // A queued row with sent_at set is going out right now; it is left to finish.
    db
      .update(emails)
      .set(cancel)
      .where(and(idIn(idsOf("queued")), eq(emails.status, "queued"), isNull(emails.sentAt)))
      .returning({ id: emails.id }),
  ]);

  return {
    previous: {
      status: lead.status,
      aiMode: lead.aiMode,
      handoffReason: lead.handoffReason,
      followUpOn: lead.followUpOn,
    },
    cancelledIds: {
      queued: queued.map((row) => row.id),
      draft: drafts.map((row) => row.id),
    },
  };
}

/**
 * Puts a just-closed conversation back exactly as it was, outside the normal status rules
 * (a discarded lead may not go back to "replied" otherwise). Only e-mails this close
 * cancelled come back; a lead that opted out in the meantime stays closed.
 */
export async function undoCloseConversation(
  db: Db,
  leadId: string,
  { previous, cancelledIds }: CloseSnapshot,
) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead não encontrado");
  if (lead.unsubscribedAt) throw new Error(UNSUBSCRIBED_MESSAGE);
  if (lead.status !== "closed" && lead.status !== "discarded") {
    throw new Error("Esta conversa já foi reaberta.");
  }
  const ids = [...cancelledIds.queued, ...cancelledIds.draft];
  const owners = await db.select({ leadId: emails.leadId }).from(emails).where(idIn(ids));
  if (owners.some((row) => row.leadId !== leadId)) {
    throw new Error("Esses e-mails não são desta conversa.");
  }

  const restored = await db
    .update(leads)
    .set({ ...previous, discardReason: null, discardedAt: null })
    .where(
      and(
        eq(leads.id, leadId),
        inArray(leads.status, ["closed", "discarded"]),
        isNull(leads.unsubscribedAt),
      ),
    )
    .returning({ id: leads.id });
  if (restored.length === 0) throw new Error("A conversa mudou enquanto isso. Atualize a tela.");

  const ours = and(
    eq(emails.leadId, leadId),
    eq(emails.status, "cancelled"),
    eq(emails.error, CLOSED_REASON),
  );
  await db.batch([
    db
      .update(emails)
      .set({ status: "queued", error: null })
      .where(and(idIn(cancelledIds.queued), ours)),
    db
      .update(emails)
      .set({ status: "draft", error: null })
      .where(and(idIn(cancelledIds.draft), ours)),
  ]);
  return { ok: true as const };
}

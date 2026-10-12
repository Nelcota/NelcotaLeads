import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { emails, leads, type Email } from "@/db/schema";
import { localDay } from "@/lib/format";
import { idSchema } from "@/lib/schemas";
import { leadPatch, UNSUBSCRIBED_MESSAGE } from "./lead-status";
import { RETRIED_PREFIX } from "@/lib/email-errors";
import {
  addressUnsubscribed,
  CLOSED_REASON,
  replySubject,
  stripComposed,
  userDraftOf,
} from "./mail-flow";
import { loadSettings } from "./settings-store";

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

/** The draft the composer shows: the user's own reply wins over anything the AI wrote. */
export function conversationDraft(drafts: Email[]): Email | null {
  return drafts.find((draft) => draft.author === "user") ?? drafts.at(-1) ?? null;
}

/**
 * Stores the reply the user is typing as their one draft for the lead (an empty body removes
 * it). Saved as typed, without the signature, which is added when it is sent.
 */
export async function saveReplyDraft(
  db: Db,
  { leadId, body, fromAddress }: { leadId: string; body: string; fromAddress: string },
): Promise<Email | null> {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead não encontrado");
  if (lead.unsubscribedAt || lead.status === "closed" || lead.status === "discarded") {
    throw new Error("Esta conversa está encerrada.");
  }
  if (!lead.email) throw new Error("Este lead não tem e-mail.");
  const mine = userDraftOf(lead.id);
  if (!body.trim()) {
    await db.delete(emails).where(mine);
    return null;
  }

  const [lastIn, lastAny] = await Promise.all([
    db.query.emails.findFirst({
      where: and(eq(emails.leadId, lead.id), eq(emails.direction, "in")),
      orderBy: [desc(emails.createdAt)],
    }),
    db.query.emails.findFirst({
      where: and(eq(emails.leadId, lead.id), inArray(emails.status, ["sent", "received"])),
      orderBy: [desc(emails.createdAt)],
    }),
  ]);
  const inReplyTo = lastIn?.messageId ?? null;
  const write = () => db.update(emails).set({ body, inReplyTo }).where(mine).returning();
  const [updated] = await write();
  if (updated) return updated;
  // Insert-if-absent keeps it at one draft per lead even if two saves race.
  await db.run(sql`
    insert into emails (id, lead_id, direction, status, author, from_address, to_address, subject, body, in_reply_to)
    select ${crypto.randomUUID()}, ${lead.id}, 'out', 'draft', 'user', ${fromAddress}, ${lead.email},
      ${replySubject(lastAny?.subject ?? "Olá")}, ${body}, ${inReplyTo}
    where not exists (select 1 from emails where lead_id = ${lead.id} and status = 'draft' and author = 'user')`);
  const [saved] = await write();
  return saved ?? null;
}

/**
 * Sends a failed e-mail again as a new queued row; the failed one stays as it was, marked
 * "Reenviado". Marking it is the claim, so two clicks (or two tabs) queue it only once, and
 * the normal send then applies the daily limit and the gap like for any other e-mail.
 */
export async function retryEmail(
  db: Db,
  emailId: string,
  { fromAddress, now = new Date() }: { fromAddress: string; now?: Date },
): Promise<Email> {
  const failed = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
  if (!failed || failed.direction !== "out" || failed.status !== "failed") {
    throw new Error("Só dá para reenviar um e-mail que falhou.");
  }
  if (failed.error?.startsWith(RETRIED_PREFIX)) throw new Error("Este e-mail já foi reenviado.");
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, failed.leadId) });
  if (!lead?.email) throw new Error("Este lead não tem e-mail.");
  if (lead.unsubscribedAt || (await addressUnsubscribed(db, lead.email))) {
    throw new Error("Este lead pediu para não receber e-mails.");
  }
  if (lead.status === "closed" || lead.status === "discarded") {
    throw new Error("Reabra a conversa para reenviar.");
  }

  const claimed = await db
    .update(emails)
    .set({ error: `${RETRIED_PREFIX}${failed.error ?? "erro"}` })
    .where(
      and(
        eq(emails.id, failed.id),
        eq(emails.status, "failed"),
        or(isNull(emails.error), sql`${emails.error} not like ${`${RETRIED_PREFIX}%`}`),
      ),
    )
    .returning({ id: emails.id });
  if (claimed.length === 0) throw new Error("Este e-mail já foi reenviado.");
  try {
    const [queued] = await db
      .insert(emails)
      .values({
        id: crypto.randomUUID(),
        leadId: lead.id,
        direction: "out",
        status: "queued",
        // The person asked for it, so it goes out even with the AI off.
        author: "user",
        fromAddress,
        toAddress: lead.email,
        subject: failed.subject,
        body: failed.body,
        inReplyTo: failed.inReplyTo,
        sendAfter: now,
      })
      .returning();
    if (!queued) throw new Error("Não foi possível reenviar.");
    return queued;
  } catch (error) {
    // Nothing was queued: free the failed e-mail for another try.
    await db.update(emails).set({ error: failed.error }).where(eq(emails.id, failed.id));
    throw error;
  }
}

const SENDING_NOW = "Já está saindo, não dá mais para cancelar.";
const SENDING_NOW_EDIT = "Já está saindo, não dá mais para editar.";
const NOT_QUEUED = "Este e-mail não está mais na fila.";

/** Not yet picked up by a send: a queued row whose sent_at (the send's claim) is empty. */
function waiting(emailId: string) {
  return and(eq(emails.id, emailId), eq(emails.status, "queued"), isNull(emails.sentAt));
}

async function whyNotWaiting(db: Db, emailId: string, sendingMessage: string) {
  const row = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
  return new Error(
    row?.status === "queued" || row?.status === "sent" ? sendingMessage : NOT_QUEUED,
  );
}

/** Takes a queued e-mail out of the queue, unless a send already picked it up. */
export async function cancelQueuedEmail(db: Db, emailId: string): Promise<Email> {
  const [cancelled] = await db
    .update(emails)
    .set({ status: "cancelled", error: "Cancelado por você" })
    .where(waiting(emailId))
    .returning();
  if (!cancelled) throw await whyNotWaiting(db, emailId, SENDING_NOW);
  return cancelled;
}

/**
 * Turns a queued e-mail back into the user's reply draft (without the signature and opt-out
 * line, which are added again when it is sent). Refused when the user already has a draft,
 * so nothing they typed is replaced.
 */
export async function editQueuedEmail(db: Db, emailId: string): Promise<Email> {
  const email = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
  if (!email || email.status !== "queued") throw new Error(NOT_QUEUED);
  if (email.sentAt) throw new Error(SENDING_NOW_EDIT);
  const settings = await loadSettings(db);
  const [draft] = await db
    .update(emails)
    .set({
      status: "draft",
      author: "user",
      body: stripComposed(email.body, settings),
      sendAfter: null,
      error: null,
    })
    .where(
      and(
        waiting(emailId),
        sql`not exists (select 1 from emails d where d.lead_id = ${email.leadId} and d.status = 'draft' and d.author = 'user')`,
      ),
    )
    .returning();
  if (draft) return draft;
  const [mine] = await db.select({ id: emails.id }).from(emails).where(userDraftOf(email.leadId));
  if (mine)
    throw new Error("Você já tem uma resposta em rascunho. Envie ou apague antes de editar.");
  throw await whyNotWaiting(db, emailId, SENDING_NOW_EDIT);
}

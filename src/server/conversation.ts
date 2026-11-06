import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/client";
import { inList } from "@/db/in-list";
import { emails, leadEvents, leads, meetings, type Email, type Lead } from "@/db/schema";
import type { LeadAnalyzer } from "@/lib/ai";
import { cleanText, ForbiddenPhrasesError } from "@/lib/ai/analyzer";
import type { ThreadMessage } from "@/lib/ai/prompts";
import { localDay } from "@/lib/format";
import { idSchema, storedDaySchema } from "@/lib/schemas";
import { leadEvent, statusEvents, type LeadEventRow } from "./lead-events";
import {
  LEAD_CHANGED_MESSAGE,
  LEAD_TRANSITIONS,
  leadPatch,
  outcomeReset,
  UNSUBSCRIBED_MESSAGE,
} from "./lead-status";
import { cancelMeetingsStatements, futureMeetingIds, MEETING_CLOSED_REASON } from "./meeting-store";
import { RETRIED_PREFIX } from "@/lib/email-errors";
import {
  addressUnsubscribed,
  CLOSED_REASON,
  insertDraftUnlessUserHasOne,
  leadContext,
  outgoingIssues,
  replySubject,
  stripComposed,
  thread,
  userDraftOf,
} from "./mail-flow";
import { hasOffer, NO_OFFER_MESSAGE } from "./process-lead";
import { loadSettings } from "./settings-store";
import { isSalesEmail, relinkSalesEmail, SALES_RETRY_OFF_MESSAGE } from "./sales-mail";
import { recordAiCost } from "./usage";

/**
 * Actions a person takes on one e-mail conversation. Nothing here deletes what was written:
 * pending e-mails are cancelled (and can come back), so every step can be undone.
 */

/** Matches only the listed ids; an empty list matches nothing. */
function idIn(ids: string[]) {
  return inList(emails.id, ids);
}

export const closeSnapshotSchema = z.object({
  previous: z.object({
    status: z.enum(["new", "contacted", "replied"]),
    aiMode: z.boolean(),
    handoffReason: z.string().max(300).nullable(),
    followUpOn: storedDaySchema.nullable(),
  }),
  cancelledIds: z.object({
    queued: z.array(idSchema).max(200),
    draft: z.array(idSchema).max(200),
  }),
  // Upcoming meetings the close cancelled; undo puts them back on the agenda.
  cancelledMeetings: z.array(idSchema).max(200).default([]),
});
export type CloseSnapshot = z.infer<typeof closeSnapshotSchema>;

/** The won or lost deal's columns a close may also write. */
export type DealFields = Partial<
  Pick<
    Lead,
    | "closedAt"
    | "dealValueCents"
    | "dealService"
    | "lossReason"
    | "lossNote"
    | "lostAt"
    | "discardReason"
    | "discardedAt"
    | "unsubscribedAt"
  >
>;

/**
 * Who closed it (for the history), and the deal and its event when one was recorded.
 * `automatic` marks a close no person asked for, the only one that may discard without a reason.
 */
export type CloseOptions = {
  userId?: string | null;
  deal?: DealFields;
  events?: LeadEventRow[];
  automatic?: boolean;
};

export const WON_NEEDS_DEAL_MESSAGE = "Para fechar o negócio, informe o valor e o serviço.";
export const LOST_NEEDS_REASON_MESSAGE = "Para encerrar sem negócio, escolha o motivo.";

/** A won close always carries the deal; a person's lost close always carries the reason. */
function assertDealData(outcome: "closed" | "discarded", deal: DealFields, automatic: boolean) {
  if (outcome === "closed" && (deal.dealValueCents == null || !deal.dealService)) {
    throw new Error(WON_NEEDS_DEAL_MESSAGE);
  }
  if (outcome === "discarded" && !automatic && !deal.lossReason) {
    throw new Error(LOST_NEEDS_REASON_MESSAGE);
  }
}

/** Drafts and queued e-mails no send picked up yet, by status. */
async function pendingEmails(db: Db, leadId: string) {
  const pending = await db
    .select({ id: emails.id, status: emails.status })
    .from(emails)
    .where(
      and(
        eq(emails.leadId, leadId),
        or(eq(emails.status, "draft"), and(eq(emails.status, "queued"), isNull(emails.sentAt))),
      ),
    );
  const idsOf = (status: string) =>
    pending.filter((row) => row.status === status).map((row) => row.id);
  return { drafts: idsOf("draft"), queued: idsOf("queued") };
}

/**
 * Ends a conversation as won (closed) or lost (discarded). The lead is moved first, guarded on
 * the status just read, so two clicks (or two tabs) close it once. Then drafts and queued
 * e-mails not yet picked up by a send are cancelled, and so are the upcoming meetings; the
 * returned snapshot is what `undoCloseConversation` needs to put everything back. The status
 * change (and the deal, if given) goes to the history.
 */
export async function closeConversation(
  db: Db,
  leadId: string,
  outcome: "closed" | "discarded",
  now = new Date(),
  { userId = null, deal = {}, events = [], automatic = false }: CloseOptions = {},
): Promise<CloseSnapshot> {
  assertDealData(outcome, deal, automatic);
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead não encontrado");
  if (lead.status === "closed" || lead.status === "discarded") {
    throw new Error("Esta conversa já está encerrada.");
  }
  // Throws when the lead cannot end this way (e.g. it was never contacted).
  const patch = leadPatch(lead, { id: lead.id, status: outcome }, now, localDay(now));
  const moved = await db
    .update(leads)
    .set({ ...patch, ...deal, aiMode: false, handoffReason: null })
    .where(and(eq(leads.id, lead.id), eq(leads.status, lead.status)))
    .returning({ id: leads.id });
  if (moved.length === 0) throw new Error(LEAD_CHANGED_MESSAGE);

  const [pending, meetingIds] = await Promise.all([
    pendingEmails(db, lead.id),
    futureMeetingIds(db, lead.id, now),
  ]);
  const cancel = { status: "cancelled" as const, error: CLOSED_REASON };
  const [drafts, queued] = await db.batch([
    db
      .update(emails)
      .set(cancel)
      .where(and(idIn(pending.drafts), eq(emails.status, "draft")))
      .returning({ id: emails.id }),
    // A queued row with sent_at set is going out right now; it is left to finish.
    db
      .update(emails)
      .set(cancel)
      .where(and(idIn(pending.queued), eq(emails.status, "queued"), isNull(emails.sentAt)))
      .returning({ id: emails.id }),
    db
      .insert(leadEvents)
      .values([...statusEvents(lead.id, lead.status, outcome, userId, now), ...events]),
    ...cancelMeetingsStatements(db, lead.id, meetingIds, now),
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
    cancelledMeetings: meetingIds,
  };
}

/**
 * Puts a just-closed conversation back exactly as it was, outside the normal status rules
 * (a discarded lead may not go back to "replied" otherwise). Only e-mails and meetings this
 * close cancelled come back; a lead that opted out in the meantime stays closed.
 */
export async function undoCloseConversation(
  db: Db,
  leadId: string,
  { previous, cancelledIds, cancelledMeetings }: CloseSnapshot,
  { userId = null, now = new Date() }: { userId?: string | null; now?: Date } = {},
) {
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead não encontrado");
  if (lead.unsubscribedAt) throw new Error(UNSUBSCRIBED_MESSAGE);
  if (lead.status !== "closed" && lead.status !== "discarded") {
    throw new Error("Esta conversa já foi reaberta.");
  }
  // The snapshot comes from the page: it may only name a status this close could have
  // come from, so undo never becomes a way around LEAD_TRANSITIONS.
  if (!LEAD_TRANSITIONS[previous.status].includes(lead.status)) {
    throw new Error("Não é possível desfazer: a conversa não estava nesse estado.");
  }
  const ids = [...cancelledIds.queued, ...cancelledIds.draft];
  const owners = await db.select({ leadId: emails.leadId }).from(emails).where(idIn(ids));
  if (owners.some((row) => row.leadId !== leadId)) {
    throw new Error("Esses e-mails não são desta conversa.");
  }

  const restored = await db
    .update(leads)
    .set({ ...previous, ...outcomeReset(previous.status), discardReason: null, discardedAt: null })
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
    or(eq(emails.error, CLOSED_REASON), eq(emails.error, MEETING_CLOSED_REASON)),
  );
  await db.batch([
    db
      .insert(leadEvents)
      .values(leadEvent(leadId, "status", { from: lead.status, to: previous.status }, userId, now)),
    db
      .update(emails)
      .set({ status: "queued", error: null })
      .where(and(idIn(cancelledIds.queued), ours)),
    db
      .update(emails)
      .set({ status: "draft", error: null })
      .where(and(idIn(cancelledIds.draft), ours)),
    // Only this lead's meetings, and only those still ahead.
    db
      .update(meetings)
      .set({ cancelledAt: null })
      .where(
        and(
          inList(meetings.id, cancelledMeetings),
          eq(meetings.leadId, leadId),
          isNotNull(meetings.cancelledAt),
          gt(meetings.startsAt, now),
        ),
      ),
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
      // The lead's own last message: an out-of-office is never what we answer.
      where: and(
        eq(emails.leadId, lead.id),
        eq(emails.direction, "in"),
        eq(emails.automatic, false),
      ),
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
  await insertDraftUnlessUserHasOne(db, {
    leadId: lead.id,
    author: "user",
    fromAddress,
    toAddress: lead.email,
    subject: replySubject(lastAny?.subject ?? "Olá"),
    body,
    inReplyTo,
  });
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
  {
    fromAddress,
    now = new Date(),
    salesEmails = false,
  }: { fromAddress: string; now?: Date; salesEmails?: boolean },
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
  // Invites and proposals follow SALES_EMAILS_ENABLED, also when sent again.
  if (!salesEmails && (await isSalesEmail(db, failed.id))) throw new Error(SALES_RETRY_OFF_MESSAGE);

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
  let queued: Email | undefined;
  try {
    [queued] = await db
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
  } catch (error) {
    // Nothing was queued: free the failed e-mail for another try.
    await db.update(emails).set({ error: failed.error }).where(eq(emails.id, failed.id));
    throw error;
  }
  await relinkSalesEmail(db, failed.id, queued.id);
  return queued;
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

export const UNSAFE_AI_REPLY = "A IA não conseguiu uma resposta segura. Escreva você mesmo.";
const AI_UNAVAILABLE = "A IA não conseguiu escrever agora. Tente de novo.";

/**
 * Asks the AI for an answer to the conversation, or a rewrite of the reply in the composer,
 * and keeps it as the user's draft (which wins over anything else). Nothing is sent. Text
 * that fails the auto-responder's output checks (links, e-mails, phones, prices, length) is
 * refused, so it never reaches the composer.
 */
export async function draftReplyWithAi(
  deps: { db: Db; analyzer: LeadAnalyzer; fromAddress: string },
  { leadId, instruction }: { leadId: string; instruction?: string },
): Promise<Email> {
  const { db, analyzer } = deps;
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead não encontrado");
  if (lead.unsubscribedAt || lead.status === "closed" || lead.status === "discarded") {
    throw new Error("Esta conversa está encerrada.");
  }
  if (!lead.email) throw new Error("Este lead não tem e-mail.");
  const settings = await loadSettings(db);
  if (!hasOffer(settings)) throw new Error(NO_OFFER_MESSAGE);

  const [history, drafts, context] = await Promise.all([
    thread(db, lead.id),
    db
      .select()
      .from(emails)
      .where(and(eq(emails.leadId, lead.id), eq(emails.status, "draft")))
      .orderBy(asc(emails.createdAt)),
    leadContext(db, lead),
  ]);
  // The text the composer shows is what gets rewritten.
  const current = conversationDraft(drafts)?.body;
  const conversation: ThreadMessage[] = history.map((item) => ({
    from: item.direction === "out" ? "eu" : "empresa",
    text: item.body,
  }));

  let text: string;
  try {
    const { decision, usage } = await analyzer.replyEmail(settings, context, conversation, {
      instruction,
      draft: current,
    });
    await recordAiCost(db, usage.calls ?? 1, usage.cost);
    text = cleanText(decision.reply || decision.draft);
  } catch (error) {
    if (!(error instanceof ForbiddenPhrasesError)) {
      console.error("ai reply draft failed", lead.id, error);
      // No `cause`: the provider's text must not reach the client (it is logged above).
      // oxlint-disable-next-line eslint/preserve-caught-error
      throw new Error(AI_UNAVAILABLE);
    }
    // Style tells only: a person reviews it, as with any draft the AI hands over.
    await recordAiCost(db, error.usage.calls ?? 1, error.usage.cost);
    text = cleanText(error.text);
  }
  if (!text || outgoingIssues(text).length > 0) throw new Error(UNSAFE_AI_REPLY);

  const saved = await saveReplyDraft(db, {
    leadId: lead.id,
    body: text,
    fromAddress: deps.fromAddress,
  });
  if (!saved) throw new Error(AI_UNAVAILABLE);
  return saved;
}

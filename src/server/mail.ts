import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { emails, leads } from "@/db/schema";
import { getAnalyzer } from "@/lib/ai";
import { getMailer, mailConfigured } from "@/lib/mail";
import {
  closeConversation as closeLeadConversation,
  closeSnapshotSchema,
  conversationDraft,
  saveReplyDraft as saveLeadReplyDraft,
  undoCloseConversation as undoCloseLeadConversation,
} from "./conversation";
import {
  cancelQueuedAi,
  composeBody,
  ensureOptOut,
  mailDailyLimit,
  mailErrorMessage,
  pollInbox,
  prepareDrafts,
  queueDrafts,
  regenerateDraft,
  sendDue,
  sendEmail,
} from "./mail-flow";
import { loadSettings } from "./settings-store";
import { idSchema } from "@/lib/schemas";

const id = idSchema;
const limit = () => mailDailyLimit(env.MAIL_DAILY_LIMIT);
const fromAddress = () => (env.MAIL_ADDRESS ?? "").toLowerCase();

/** Writes (or reuses) a draft for each selected lead and returns them for review. */
export const prepareEmails = createServerFn({ method: "POST" })
  .validator(z.object({ leadIds: z.array(id).min(1).max(100) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const result = await prepareDrafts(
      { db, analyzer: getAnalyzer(env), fromAddress: fromAddress() },
      data.leadIds,
    );
    const names = await db
      .select({ id: leads.id, name: leads.name })
      .from(leads)
      .where(inArray(leads.id, data.leadIds));
    const nameOf = new Map(names.map((row) => [row.id, row.name]));
    return {
      drafts: result.drafts.map((draft) => ({
        ...draft,
        leadName: nameOf.get(draft.leadId) ?? "",
      })),
      skipped: result.skipped,
    };
  });

export const updateDraft = createServerFn({ method: "POST" })
  .validator(
    z.object({
      id,
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(5000),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const draft = await db.query.emails.findFirst({
      where: and(eq(emails.id, data.id), eq(emails.status, "draft")),
      columns: { inReplyTo: true },
    });
    if (!draft) return { ok: true as const };
    // First e-mails and follow-ups (not answers to the lead) keep the "sair" line.
    const body = draft.inReplyTo ? data.body : ensureOptOut(data.body);
    await db
      .update(emails)
      .set({ subject: data.subject, body })
      .where(and(eq(emails.id, data.id), eq(emails.status, "draft")));
    return { ok: true as const };
  });

export const rewriteDraft = createServerFn({ method: "POST" })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    const db = getDb();
    await regenerateDraft({ db, analyzer: getAnalyzer(env) }, data.id);
    return db.query.emails.findFirst({ where: eq(emails.id, data.id) });
  });

export const removeDraft = createServerFn({ method: "POST" })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    await getDb()
      .delete(emails)
      .where(and(eq(emails.id, data.id), eq(emails.status, "draft")));
    return { ok: true as const };
  });

/** Queues the reviewed drafts, one every few minutes; the first goes out right away. */
export const dispatchEmails = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(id).min(1).max(100) }))
  .handler(async ({ data }) => {
    if (!mailConfigured(env)) throw new Error("Conecte a sua caixa de e-mail nas Configurações.");
    const db = getDb();
    const queued = await queueDrafts(db, data.ids);
    await sendDue({ db, mailer: getMailer(env), limit: limit() });
    return { queued };
  });

/** Sends the queue's next e-mail and reads replies now, without waiting for the cron. */
export const checkMailNow = createServerFn({ method: "POST" }).handler(async () => {
  if (!mailConfigured(env)) throw new Error("Conecte a sua caixa de e-mail nas Configurações.");
  const db = getDb();
  const mailer = getMailer(env);
  const sent = await sendDue({ db, mailer, limit: limit() });
  const received = await pollInbox({ db, mailer, analyzer: getAnalyzer(env) });
  return { sent, received };
});

export const testMailConnection = createServerFn({ method: "POST" }).handler(async () => {
  try {
    await getMailer(env).verify();
    return { ok: true as const, message: "Conexão funcionando: envio e leitura." };
  } catch (error) {
    // The server's own text stays in the log; the page gets a fixed message per step.
    console.error("mail connection test failed", error);
    return { ok: false as const, message: mailErrorMessage(error) };
  }
});

export type ConversationState = "needsYou" | "aiTalking" | "waiting" | "closed";

function stateOf(lead: {
  status: string;
  aiMode: boolean;
  unsubscribedAt: Date | null;
}): ConversationState {
  if (lead.unsubscribedAt || lead.status === "closed" || lead.status === "discarded") {
    return "closed";
  }
  if (lead.status === "replied") return lead.aiMode ? "aiTalking" : "needsYou";
  return "waiting";
}

/** Every lead with an e-mail conversation, latest activity first. */
export const listConversations = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      status: leads.status,
      aiMode: leads.aiMode,
      handoffReason: leads.handoffReason,
      unsubscribedAt: leads.unsubscribedAt,
      lastEmailAt: leads.lastEmailAt,
    })
    .from(leads)
    .where(isNotNull(leads.lastEmailAt))
    .orderBy(desc(leads.lastEmailAt))
    .limit(300);
  if (rows.length === 0) return [];

  const latest = await db
    .select({
      leadId: emails.leadId,
      body: emails.body,
      direction: emails.direction,
      author: emails.author,
      at: sql<number>`max(coalesce(${emails.sentAt}, ${emails.createdAt}))`,
    })
    .from(emails)
    .where(
      and(
        inArray(
          emails.leadId,
          rows.map((row) => row.id),
        ),
        inArray(emails.status, ["sent", "received"]),
      ),
    )
    .groupBy(emails.leadId);
  const lastOf = new Map(latest.map((row) => [row.leadId, row]));

  return rows.map((row) => {
    const last = lastOf.get(row.id);
    return {
      ...row,
      state: stateOf(row),
      preview: last
        ? `${last.direction === "out" ? (last.author === "ai" ? "IA: " : "Você: ") : ""}${last.body.replace(/\s+/g, " ").slice(0, 140)}`
        : "",
    };
  });
});

export type ConversationSummary = Awaited<ReturnType<typeof listConversations>>[number];

export const getConversation = createServerFn({ method: "GET" })
  .validator(z.object({ leadId: id }))
  .handler(async ({ data }) => {
    const db = getDb();
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, data.leadId) });
    if (!lead) throw new Error("Lead não encontrado");
    const thread = await db
      .select()
      .from(emails)
      .where(eq(emails.leadId, lead.id))
      .orderBy(asc(emails.createdAt));
    const analysis = await db.query.analyses.findFirst({
      where: (table, { eq: equals }) => equals(table.leadId, lead.id),
      orderBy: (table, { desc: descending }) => [descending(table.createdAt)],
    });
    return {
      lead,
      state: stateOf(lead),
      summary: analysis?.summary ?? null,
      messages: thread.filter((item) => item.status !== "draft"),
      draft: conversationDraft(thread.filter((item) => item.status === "draft")),
    };
  });

/** Keeps the reply being typed, so it survives leaving the page; empty removes it. */
export const saveReplyDraft = createServerFn({ method: "POST" })
  .validator(z.object({ leadId: id, body: z.string().max(5000) }))
  .handler(({ data }) => saveLeadReplyDraft(getDb(), { ...data, fromAddress: fromAddress() }));

/** Sends a reply written (or approved) by the user right away. */
export const sendReply = createServerFn({ method: "POST" })
  .validator(z.object({ leadId: id, body: z.string().trim().min(1).max(5000) }))
  .handler(async ({ data }) => {
    if (!mailConfigured(env)) throw new Error("Conecte a sua caixa de e-mail nas Configurações.");
    const db = getDb();
    const mailer = getMailer(env);
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, data.leadId) });
    if (!lead?.email) throw new Error("Este lead não tem e-mail.");
    const lastIn = await db.query.emails.findFirst({
      where: and(eq(emails.leadId, lead.id), eq(emails.direction, "in")),
      orderBy: [desc(emails.createdAt)],
    });
    const lastAny = await db.query.emails.findFirst({
      where: and(eq(emails.leadId, lead.id), inArray(emails.status, ["sent", "received"])),
      orderBy: [desc(emails.createdAt)],
    });
    const subject = lastAny?.subject ?? "Olá";
    const settings = await loadSettings(db);
    // A pending reply draft (the AI's or the user's own) is replaced by what is sent.
    await db
      .delete(emails)
      .where(
        and(
          eq(emails.leadId, lead.id),
          eq(emails.status, "draft"),
          or(isNotNull(emails.inReplyTo), eq(emails.author, "user")),
        ),
      );
    // The user answered, so a queued AI reply or follow-up would answer twice.
    await cancelQueuedAi(db, lead.id, "Cancelado: você respondeu");
    const now = new Date();
    // Inserted already claimed (sent_at set), so the cron never picks it up as well.
    const [email] = await db
      .insert(emails)
      .values({
        id: crypto.randomUUID(),
        leadId: lead.id,
        direction: "out",
        status: "queued",
        author: "user",
        fromAddress: mailer.address,
        toAddress: lead.email,
        subject: /^(re|res):/i.test(subject) ? subject : `Re: ${subject}`,
        body: composeBody(data.body, settings, false),
        inReplyTo: lastIn?.messageId ?? null,
        sendAfter: now,
        sentAt: now,
      })
      .returning();
    if (!email) throw new Error("Não foi possível criar o e-mail");
    const result = await sendEmail({ db, mailer, limit: limit() }, email, now, { claimed: true });
    if (result === "limit") {
      // Not left queued: a retry from the page would otherwise send it twice tomorrow.
      await db
        .update(emails)
        .set({ status: "failed", error: "Limite diário de e-mails atingido" })
        .where(eq(emails.id, email.id));
      throw new Error("O limite de e-mails de hoje acabou. Tente amanhã.");
    }
    if (result !== "sent") {
      const row = await db.query.emails.findFirst({ where: eq(emails.id, email.id) });
      throw new Error(row?.error ?? "O servidor de e-mail recusou o envio.");
    }
    return { ok: true as const };
  });

/** Turns the AI on or off for one conversation. */
export const setConversationAi = createServerFn({ method: "POST" })
  .validator(z.object({ leadId: id, aiMode: z.boolean() }))
  .handler(async ({ data }) => {
    const db = getDb();
    await db
      .update(leads)
      .set({ aiMode: data.aiMode, ...(data.aiMode ? { handoffReason: null } : {}) })
      .where(eq(leads.id, data.leadId));
    if (!data.aiMode)
      await cancelQueuedAi(db, data.leadId, "Cancelado: a conversa passou para você");
    return { ok: true as const };
  });

/** Ends a conversation as won (closed) or lost (discarded); returns what undo needs. */
export const closeConversation = createServerFn({ method: "POST" })
  .validator(z.object({ leadId: id, outcome: z.enum(["closed", "discarded"]) }))
  .handler(({ data }) => closeLeadConversation(getDb(), data.leadId, data.outcome));

/** Undoes `closeConversation` from the snapshot it returned. */
export const undoCloseConversation = createServerFn({ method: "POST" })
  .validator(closeSnapshotSchema.extend({ leadId: id }))
  .handler(({ data: { leadId, ...snapshot } }) =>
    undoCloseLeadConversation(getDb(), leadId, snapshot),
  );

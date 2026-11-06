import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Db } from "@/db/client";
import { inList } from "@/db/in-list";
import { emails, leads, searches } from "@/db/schema";
import { getAnalyzer } from "@/lib/ai";
import { getMailer, mailConfigured } from "@/lib/mail";
import { splitQuoted } from "@/lib/mail/quoted";
import {
  cancelQueuedEmail as cancelQueued,
  closeSnapshotSchema,
  conversationDraft,
  draftReplyWithAi as draftLeadReplyWithAi,
  editQueuedEmail as editQueued,
  retryEmail as retryFailedEmail,
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
  replySubject,
  sendDue,
  sendEmail,
} from "./mail-flow";
import { requestUserId } from "./request-user";
import { runSendJob, trackJob, watchSends } from "./job-runs";
import { loadSettings } from "./settings-store";
import { DAILY_LIMIT_ERROR } from "@/lib/email-errors";
import { friendlyJobError } from "@/lib/system-status";
import { salesEmailsEnabled } from "@/lib/sales-email";
import { DISPATCH_LIMIT, idSchema, TEXT_LIMITS } from "@/lib/schemas";

const id = idSchema;
// The mailbox is set up by whoever runs the system, never in the app.
const MAIL_NOT_CONNECTED =
  "A caixa de e-mail ainda não foi conectada por quem administra o sistema.";
const limit = () => mailDailyLimit(env.MAIL_DAILY_LIMIT);
const fromAddress = () => (env.MAIL_ADDRESS ?? "").toLowerCase();
const salesEmails = () => salesEmailsEnabled(env.SALES_EMAILS_ENABLED);

/** Writes (or reuses) a draft for each selected lead and returns them for review. */
export const prepareEmails = createServerFn({ method: "POST" })
  .validator(
    z.object({
      leadIds: z
        .array(id)
        .min(1)
        .max(DISPATCH_LIMIT, `Selecione até ${DISPATCH_LIMIT} leads por disparo.`),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const result = await prepareDrafts(
      { db, analyzer: getAnalyzer(env), fromAddress: fromAddress() },
      data.leadIds,
    );
    const names = await db
      .select({ id: leads.id, name: leads.name })
      .from(leads)
      .where(inList(leads.id, data.leadIds));
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
      subject: z.string().trim().min(1).max(TEXT_LIMITS.subject.model),
      // The draft holds the signature and "sair" line too, so it may pass the model's bound.
      body: z.string().trim().min(1).max(TEXT_LIMITS.emailBody.stored),
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
    // Checked after the "sair" line is added, so what is saved can always be edited again.
    if (body.length > TEXT_LIMITS.emailBody.stored) throw new Error("O e-mail ficou longo demais.");
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

/**
 * Queues the reviewed drafts in score order, one every few minutes inside the send window; the
 * first goes out right away when the window is open and the run is not paused.
 */
export const dispatchEmails = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(id).min(1).max(DISPATCH_LIMIT) }))
  .handler(async ({ data }) => {
    if (!mailConfigured(env)) throw new Error(MAIL_NOT_CONNECTED);
    const db = getDb();
    const queued = await queueDrafts(db, data.ids);
    const watch = watchSends(getMailer(env));
    await sendDue({ db, mailer: watch.mailer, limit: limit(), salesEmails: salesEmails() });
    await watch.record(db);
    return { queued };
  });

/**
 * Sends the queue's next e-mail and reads replies now, without waiting for the cron (also the
 * "Tentar agora" of both mail tasks in Conta → Status). A refused send is shown on the e-mail
 * and in Status, so only a failed inbox read is thrown, with a friendly message.
 */
export const checkMailNow = createServerFn({ method: "POST" }).handler(async () => {
  if (!mailConfigured(env)) throw new Error(MAIL_NOT_CONNECTED);
  const db = getDb();
  const mailer = getMailer(env);
  const sent = await runSendJob(
    { db, mailer, limit: limit(), salesEmails: salesEmails() },
    new Date(),
    {
      verifyWhenIdle: true,
    },
  ).catch(() => 0);
  try {
    const received = await trackJob(db, "inbox", () =>
      pollInbox({ db, mailer, analyzer: getAnalyzer(env) }),
    );
    return { sent, received };
  } catch (error) {
    // oxlint-disable-next-line eslint/preserve-caught-error -- the raw text stays in the log
    throw new Error(friendlyJobError("inbox", error));
  }
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

/** Conversations the page lists; past this, only the most recent ones show. */
export const CONVERSATIONS_LIMIT = 300;

/** Every lead with an e-mail conversation, latest activity first. */
export const listConversations = createServerFn({ method: "GET" }).handler(() =>
  queryConversations(getDb()),
);

export async function queryConversations(db: Db) {
  const rows = await db
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      status: leads.status,
      aiMode: leads.aiMode,
      handoffReason: leads.handoffReason,
      unsubscribedAt: leads.unsubscribedAt,
      lastEmailAt: leads.lastEmailAt,
      // Same key as listNiches, so the niche filter matches it.
      niche: sql<string>`lower(trim(${searches.niche}))`,
    })
    .from(leads)
    .innerJoin(searches, eq(searches.id, leads.searchId))
    .where(isNotNull(leads.lastEmailAt))
    // The ones waiting for the user are never cut off by the limit, however old.
    .orderBy(
      sql`case when ${leads.status} = 'replied' and ${leads.aiMode} = 0 and ${leads.unsubscribedAt} is null then 0 else 1 end`,
      desc(leads.lastEmailAt),
    )
    .limit(CONVERSATIONS_LIMIT);
  if (rows.length === 0) return [];
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array from the query
  rows.sort((a, b) => (b.lastEmailAt?.getTime() ?? 0) - (a.lastEmailAt?.getTime() ?? 0));

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
        inList(
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
    // A reply previews what the lead wrote, not the original it quotes.
    const text = last?.direction === "in" ? splitQuoted(last.body).visible : last?.body;
    return {
      ...row,
      state: stateOf(row),
      preview: last
        ? `${last.direction === "out" ? (last.author === "ai" ? "IA: " : "Você: ") : ""}${(text ?? "").replace(/\s+/g, " ").slice(0, 140)}`
        : "",
    };
  });
}

export type ConversationSummary = Awaited<ReturnType<typeof queryConversations>>[number];

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

/** The AI writes (or rewrites) the reply in the composer, as the user's draft; sends nothing. */
export const draftReplyWithAi = createServerFn({ method: "POST" })
  .validator(z.object({ leadId: id, instruction: z.string().trim().max(300).optional() }))
  .handler(async ({ data }) => {
    let analyzer;
    try {
      analyzer = getAnalyzer(env);
    } catch (error) {
      console.error("analyzer unavailable", error);
      // oxlint-disable-next-line eslint/preserve-caught-error
      throw new Error("A IA não está configurada. Fale com quem administra o sistema.");
    }
    return draftLeadReplyWithAi({ db: getDb(), analyzer, fromAddress: fromAddress() }, data);
  });

/** Sends a reply written (or approved) by the user right away. */
export const sendReply = createServerFn({ method: "POST" })
  .validator(z.object({ leadId: id, body: z.string().trim().min(1).max(5000) }))
  .handler(async ({ data }) => {
    if (!mailConfigured(env)) throw new Error(MAIL_NOT_CONNECTED);
    const db = getDb();
    const mailer = getMailer(env);
    const lead = await db.query.leads.findFirst({ where: eq(leads.id, data.leadId) });
    if (!lead?.email) throw new Error("Este lead não tem e-mail.");
    const lastIn = await db.query.emails.findFirst({
      // The lead's own last message: an out-of-office is never what we answer.
      where: and(
        eq(emails.leadId, lead.id),
        eq(emails.direction, "in"),
        eq(emails.automatic, false),
      ),
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
        subject: replySubject(subject),
        // Without a message from the lead this is cold outreach, which carries the opt-out line.
        body: composeBody(data.body, settings, !lastIn),
        inReplyTo: lastIn?.messageId ?? null,
        sendAfter: now,
        sentAt: now,
      })
      .returning();
    if (!email) throw new Error("Não foi possível criar o e-mail");
    const watch = watchSends(mailer);
    const result = await sendEmail(
      { db, mailer: watch.mailer, limit: limit(), salesEmails: salesEmails() },
      email,
      now,
      {
        claimed: true,
      },
    );
    await watch.record(db, now);
    if (result === "limit") {
      // Not left queued: a retry from the page would otherwise send it twice tomorrow.
      await db
        .update(emails)
        .set({ status: "failed", error: DAILY_LIMIT_ERROR })
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

/** Undoes "Fechar negócio" or "Encerrar sem negócio" from the snapshot it returned. */
export const undoCloseConversation = createServerFn({ method: "POST" })
  .validator(closeSnapshotSchema.extend({ leadId: id }))
  .handler(async ({ data: { leadId, ...snapshot } }) =>
    undoCloseLeadConversation(getDb(), leadId, snapshot, { userId: await requestUserId() }),
  );

/** Sends a failed e-mail again; it goes through the queue (limit and gap) like any other. */
export const retryEmail = createServerFn({ method: "POST" })
  .validator(z.object({ emailId: id }))
  .handler(async ({ data }) => {
    if (!mailConfigured(env)) throw new Error(MAIL_NOT_CONNECTED);
    const db = getDb();
    const mailer = getMailer(env);
    await retryFailedEmail(db, data.emailId, {
      fromAddress: mailer.address,
      salesEmails: salesEmails(),
    });
    const watch = watchSends(mailer);
    await sendDue({ db, mailer: watch.mailer, limit: limit(), salesEmails: salesEmails() });
    await watch.record(db);
    return { ok: true as const };
  });

/** Takes an e-mail out of the send queue while no send has picked it up. */
export const cancelQueuedEmail = createServerFn({ method: "POST" })
  .validator(z.object({ emailId: id }))
  .handler(async ({ data }) => {
    await cancelQueued(getDb(), data.emailId);
    return { ok: true as const };
  });

/** Moves a queued e-mail back to the composer as the user's draft. */
export const editQueuedEmail = createServerFn({ method: "POST" })
  .validator(z.object({ emailId: id }))
  .handler(({ data }) => editQueued(getDb(), data.emailId));

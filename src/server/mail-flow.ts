import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  analyses,
  emails,
  leads,
  searches,
  settings as settingsTable,
  type Email,
  type Lead,
} from "@/db/schema";
import type { LeadAnalyzer } from "@/lib/ai";
import { cleanText } from "@/lib/ai/analyzer";
import type { ThreadMessage } from "@/lib/ai/prompts";
import { dayDiff, localDay } from "@/lib/format";
import { newMessageId, type IncomingEmail, type Mailer } from "@/lib/mail";
import type { SettingsInput } from "@/lib/schemas";
import { leadPatch } from "./lead-status";
import { buildContext, hasOffer, NO_OFFER_MESSAGE } from "./process-lead";
import { DEFAULT_SETTINGS, loadSettings } from "./settings-store";
import { recordAiCost, requestsToday, reserveRequest } from "./usage";

export const EMAIL_PROVIDER = "email";
export const DEFAULT_MAIL_DAILY_LIMIT = 30;
export const SEND_GAP_MINUTES = 8;
// Replies go out after a short pause, like a person reading and answering.
const REPLY_DELAY_MINUTES = 2;
const MAX_AI_REPLIES = 3;
export const EMAIL_OPT_OUT = 'Para não receber mais e-mails, responda com "sair".';
const UNSUBSCRIBE = /^\s*(sair|descadastr\w*|remover|remova|parar|pare|stop|unsubscribe)\b/i;

export function mailDailyLimit(value: string | undefined): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isInteger(n) && n >= 0
    ? n
    : DEFAULT_MAIL_DAILY_LIMIT;
}

/** Body plus signature, and the opt-out line on first contacts and follow-ups. */
export function composeBody(text: string, settings: SettingsInput, optOut: boolean): string {
  const signature = [settings.senderName, settings.senderCompany].filter(Boolean).join("\n");
  return [cleanText(text), signature, optOut ? EMAIL_OPT_OUT : ""].filter(Boolean).join("\n\n");
}

function replySubject(subject: string) {
  return /^(re|res|resp):/i.test(subject.trim()) ? subject : `Re: ${subject}`;
}

async function latestAnalysis(db: Db, leadId: string) {
  return db.query.analyses.findFirst({
    where: eq(analyses.leadId, leadId),
    orderBy: [desc(analyses.createdAt), desc(analyses.id)],
  });
}

async function leadContext(db: Db, lead: Lead) {
  const search = await db.query.searches.findFirst({ where: eq(searches.id, lead.searchId) });
  return buildContext(lead, search);
}

function thread(db: Db, leadId: string) {
  return db
    .select()
    .from(emails)
    .where(and(eq(emails.leadId, leadId), inArray(emails.status, ["sent", "received"])))
    .orderBy(asc(emails.createdAt), asc(emails.sentAt));
}

export type DraftSkip = { leadId: string; name: string; reason: string };

/**
 * Writes the first e-mail (as a draft) for each selected lead that can receive one.
 * Leads that already have a draft keep it.
 */
export async function prepareDrafts(
  deps: { db: Db; analyzer: LeadAnalyzer; fromAddress: string },
  leadIds: string[],
): Promise<{ drafts: Email[]; skipped: DraftSkip[] }> {
  const { db, analyzer } = deps;
  const settings = await loadSettings(db);
  if (!hasOffer(settings)) throw new Error(NO_OFFER_MESSAGE);

  const drafts: Email[] = [];
  const skipped: DraftSkip[] = [];
  const rows = await db.select().from(leads).where(inArray(leads.id, leadIds));
  for (const lead of rows) {
    const skip = (reason: string) => skipped.push({ leadId: lead.id, name: lead.name, reason });
    if (!lead.email) {
      skip("sem e-mail no site");
      continue;
    }
    if (lead.unsubscribedAt) {
      skip("pediu para não receber");
      continue;
    }
    const existing = await db.query.emails.findFirst({
      where: and(eq(emails.leadId, lead.id), eq(emails.direction, "out")),
      orderBy: [desc(emails.createdAt)],
    });
    if (existing && existing.status !== "draft") {
      skip("já recebeu e-mail");
      continue;
    }
    if (existing) {
      drafts.push(existing);
      continue;
    }
    const analysis = await latestAnalysis(db, lead.id);
    if (!analysis) {
      skip("ainda em análise");
      continue;
    }
    try {
      const { email, usage } = await analyzer.writeEmail(
        settings,
        await leadContext(db, lead),
        analysis,
      );
      await recordAiCost(db, 1, usage.cost);
      const [draft] = await db
        .insert(emails)
        .values({
          id: crypto.randomUUID(),
          leadId: lead.id,
          direction: "out",
          status: "draft",
          author: "ai",
          fromAddress: deps.fromAddress,
          toAddress: lead.email,
          subject: email.subject,
          body: composeBody(email.body, settings, true),
        })
        .returning();
      if (draft) drafts.push(draft);
    } catch (error) {
      console.error("email draft failed", lead.id, error);
      skip("a IA não conseguiu escrever agora");
    }
  }
  return { drafts, skipped };
}

/** Rewrites one draft with the AI. */
export async function regenerateDraft(deps: { db: Db; analyzer: LeadAnalyzer }, emailId: string) {
  const { db, analyzer } = deps;
  const draft = await db.query.emails.findFirst({ where: eq(emails.id, emailId) });
  if (!draft || draft.status !== "draft") throw new Error("Rascunho não encontrado");
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, draft.leadId) });
  const analysis = await latestAnalysis(db, draft.leadId);
  if (!lead || !analysis) throw new Error("O lead ainda não foi analisado");
  const settings = await loadSettings(db);
  const { email, usage } = await analyzer.writeEmail(
    settings,
    await leadContext(db, lead),
    analysis,
  );
  await recordAiCost(db, 1, usage.cost);
  await db
    .update(emails)
    .set({ subject: email.subject, body: composeBody(email.body, settings, true) })
    .where(eq(emails.id, emailId));
}

/** Puts drafts in the send queue, spaced out after whatever is already queued. */
export async function queueDrafts(db: Db, emailIds: string[], now = new Date()) {
  if (emailIds.length === 0) return 0;
  const last = await db
    .select({ at: sql<number | null>`max(${emails.sendAfter})` })
    .from(emails)
    .where(eq(emails.status, "queued"));
  const lastAt = last[0]?.at ? last[0].at * 1000 : 0;
  const gap = SEND_GAP_MINUTES * 60_000;
  const start = Math.max(now.getTime(), lastAt + gap);
  const drafts = await db
    .select({ id: emails.id })
    .from(emails)
    .where(and(inArray(emails.id, emailIds), eq(emails.status, "draft")));
  await Promise.all(
    drafts.map((draft, index) =>
      db
        .update(emails)
        .set({ status: "queued", sendAfter: new Date(start + index * gap) })
        .where(eq(emails.id, draft.id)),
    ),
  );
  return drafts.length;
}

/** Sends one e-mail now: threading headers, the daily limit and the lead's status. */
export async function sendEmail(
  deps: { db: Db; mailer: Mailer; limit: number },
  email: Email,
  now = new Date(),
): Promise<"sent" | "limit" | "failed"> {
  const { db, mailer } = deps;
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, email.leadId) });
  if (!lead || lead.unsubscribedAt) {
    await db
      .update(emails)
      .set({ status: "failed", error: "O lead pediu para não receber e-mails" })
      .where(eq(emails.id, email.id));
    return "failed";
  }
  if (!(await reserveRequest(db, EMAIL_PROVIDER, deps.limit, now))) return "limit";

  const previous = await thread(db, lead.id);
  const references = previous.flatMap((item) => (item.messageId ? [item.messageId] : []));
  const messageId = newMessageId(mailer.address);
  try {
    await mailer.send({
      from: { address: mailer.address, name: (await loadSettings(db)).senderName || undefined },
      to: email.toAddress,
      subject: email.subject,
      text: email.body,
      messageId,
      inReplyTo: email.inReplyTo ?? references.at(-1) ?? null,
      references,
      unsubscribe: mailer.address,
      date: now,
    });
  } catch (error) {
    await db
      .update(emails)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message.slice(0, 500) : "Falha",
      })
      .where(eq(emails.id, email.id));
    return "failed";
  }

  await db
    .update(emails)
    .set({ status: "sent", sentAt: now, messageId, fromAddress: mailer.address })
    .where(eq(emails.id, email.id));
  const contact =
    lead.status === "new"
      ? leadPatch(lead, { id: lead.id, status: "contacted" }, now, localDay(now))
      : {};
  await db
    .update(leads)
    .set({ ...contact, lastEmailAt: now })
    .where(eq(leads.id, lead.id));
  return "sent";
}

/** One e-mail per tick from the queue, so sends stay spaced out. */
export async function sendDue(deps: { db: Db; mailer: Mailer; limit: number }, now = new Date()) {
  if ((await requestsToday(deps.db, EMAIL_PROVIDER, now)) >= deps.limit) return 0;
  const next = await deps.db.query.emails.findFirst({
    where: and(eq(emails.status, "queued"), lte(emails.sendAfter, now)),
    orderBy: [asc(emails.sendAfter)],
  });
  if (!next) return 0;
  return (await sendEmail(deps, next, now)) === "sent" ? 1 : 0;
}

/** Reads new replies from the mailbox and lets the AI answer them. */
export async function pollInbox(
  deps: { db: Db; mailer: Mailer; analyzer: LeadAnalyzer },
  now = new Date(),
): Promise<number> {
  const { db, mailer } = deps;
  const row = await db.query.settings.findFirst();
  const { cursor, messages } = await mailer.fetchNew({
    uidValidity: row?.mailUidValidity ?? 0,
    lastUid: row?.mailLastUid ?? 0,
  });
  await db
    .insert(settingsTable)
    .values({
      id: 1,
      ...DEFAULT_SETTINGS,
      mailUidValidity: cursor.uidValidity,
      mailLastUid: cursor.lastUid,
    })
    .onConflictDoUpdate({
      target: settingsTable.id,
      set: { mailUidValidity: cursor.uidValidity, mailLastUid: cursor.lastUid },
    });

  let handled = 0;
  for (const message of messages) {
    if (await handleInbound(deps, message, now)) handled += 1;
  }
  return handled;
}

async function findLead(db: Db, message: IncomingEmail) {
  const ids = [message.inReplyTo, ...message.references].filter((id): id is string => Boolean(id));
  if (ids.length > 0) {
    const known = await db.query.emails.findFirst({ where: inArray(emails.messageId, ids) });
    if (known) return db.query.leads.findFirst({ where: eq(leads.id, known.leadId) });
  }
  return db.query.leads.findFirst({ where: eq(leads.email, message.from) });
}

/** Stores a reply and decides what happens next. Returns false when it is not ours. */
export async function handleInbound(
  deps: { db: Db; mailer: Mailer; analyzer: LeadAnalyzer },
  message: IncomingEmail,
  now = new Date(),
): Promise<boolean> {
  const { db, mailer, analyzer } = deps;
  if (!message.from || message.from === mailer.address) return false;
  if (message.messageId) {
    const seen = await db.query.emails.findFirst({
      where: eq(emails.messageId, message.messageId),
    });
    if (seen) return false;
  }
  const lead = await findLead(db, message);
  if (!lead) return false;

  await db.insert(emails).values({
    id: crypto.randomUUID(),
    leadId: lead.id,
    direction: "in",
    status: "received",
    author: "lead",
    fromAddress: message.from,
    toAddress: mailer.address,
    subject: message.subject,
    body: message.text || "(sem texto)",
    messageId: message.messageId,
    inReplyTo: message.inReplyTo,
    sentAt: message.date ?? now,
  });
  // Out-of-office and bounces are kept in the thread but change nothing.
  if (message.automatic) return true;

  if (UNSUBSCRIBE.test(message.text) || UNSUBSCRIBE.test(message.subject)) {
    await db.batch([
      db
        .update(leads)
        .set({
          unsubscribedAt: now,
          status: "discarded",
          aiMode: false,
          handoffReason: null,
          followUpOn: null,
          discardReason: "Pediu para não receber e-mails",
          lastEmailAt: now,
        })
        .where(eq(leads.id, lead.id)),
      db
        .update(emails)
        .set({ status: "failed", error: "Cancelado: o lead pediu para não receber" })
        .where(and(eq(emails.leadId, lead.id), inArray(emails.status, ["queued", "draft"]))),
    ]);
    return true;
  }

  await db
    .update(leads)
    .set({
      status: lead.status === "closed" ? "closed" : "replied",
      followUpOn: null,
      lastEmailAt: now,
    })
    .where(eq(leads.id, lead.id));

  const settings = await loadSettings(db);
  const autoReply = (await db.query.settings.findFirst())?.aiAutoReply ?? true;
  if (!autoReply || !lead.aiMode || !hasOffer(settings)) {
    await db
      .update(leads)
      .set({ aiMode: false, handoffReason: lead.handoffReason ?? "Respondeu" })
      .where(eq(leads.id, lead.id));
    return true;
  }

  const history = await thread(db, lead.id);
  const aiReplies = history.filter(
    (item) => item.direction === "out" && item.author === "ai" && item.inReplyTo,
  ).length;
  if (aiReplies >= MAX_AI_REPLIES) {
    await handOff(db, lead.id, `A IA já respondeu ${MAX_AI_REPLIES} vezes`);
    return true;
  }

  const conversation: ThreadMessage[] = history.map((item) => ({
    from: item.direction === "out" ? "eu" : "empresa",
    text: item.body,
  }));
  try {
    const { decision, usage } = await analyzer.replyEmail(
      settings,
      await leadContext(db, lead),
      conversation,
    );
    await recordAiCost(db, 1, usage.cost);
    const base = {
      leadId: lead.id,
      direction: "out" as const,
      author: "ai" as const,
      fromAddress: mailer.address,
      toAddress: lead.email ?? message.from,
      subject: replySubject(message.subject),
      inReplyTo: message.messageId,
    };
    if (decision.action === "reply" && decision.reply) {
      await db.insert(emails).values({
        ...base,
        id: crypto.randomUUID(),
        status: "queued",
        body: composeBody(decision.reply, settings, false),
        sendAfter: new Date(now.getTime() + REPLY_DELAY_MINUTES * 60_000),
      });
    } else if (decision.action === "close") {
      await db
        .update(leads)
        .set({
          status: "discarded",
          aiMode: false,
          discardReason: decision.reason,
          discardedAt: now,
        })
        .where(eq(leads.id, lead.id));
    } else {
      await handOff(db, lead.id, decision.reason);
      if (decision.draft) {
        await db.insert(emails).values({
          ...base,
          id: crypto.randomUUID(),
          status: "draft",
          // Kept without signature: it is added when the person sends it.
          body: cleanText(decision.draft),
        });
      }
    }
  } catch (error) {
    console.error("email reply failed", lead.id, error);
    await handOff(db, lead.id, "A IA não conseguiu responder");
  }
  return true;
}

async function handOff(db: Db, leadId: string, reason: string) {
  await db
    .update(leads)
    .set({ aiMode: false, handoffReason: reason.slice(0, 300) })
    .where(eq(leads.id, leadId));
}

/** One follow-up e-mail, in the same thread, for contacted leads that did not answer. */
export async function queueFollowUps(
  deps: { db: Db; analyzer: LeadAnalyzer; fromAddress: string },
  now = new Date(),
): Promise<number> {
  const { db, analyzer } = deps;
  const settings = await loadSettings(db);
  if (!hasOffer(settings)) return 0;
  const today = localDay(now);
  const due = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.status, "contacted"),
        lte(leads.followUpOn, today),
        eq(leads.emailFollowUps, 0),
        eq(leads.aiMode, true),
        isNotNull(leads.email),
        isNull(leads.unsubscribedAt),
      ),
    )
    .limit(10);

  let queued = 0;
  for (const lead of due) {
    const first = await db.query.emails.findFirst({
      where: and(
        eq(emails.leadId, lead.id),
        eq(emails.direction, "out"),
        eq(emails.status, "sent"),
      ),
      orderBy: [asc(emails.sentAt)],
    });
    // Leads contacted through WhatsApp have no e-mail thread to follow up on.
    if (!first || !lead.email) continue;
    try {
      const sentOn = first.sentAt ? localDay(first.sentAt) : today;
      const { message, usage } = await analyzer.writeFollowUp(
        settings,
        await leadContext(db, lead),
        { firstMessage: first.body, daysSince: Math.max(1, dayDiff(sentOn, today)) },
      );
      await recordAiCost(db, 1, usage.cost);
      await db.batch([
        db.insert(emails).values({
          id: crypto.randomUUID(),
          leadId: lead.id,
          direction: "out",
          status: "queued",
          author: "ai",
          fromAddress: deps.fromAddress,
          toAddress: lead.email,
          subject: replySubject(first.subject),
          body: composeBody(message, settings, true),
          sendAfter: now,
        }),
        db.update(leads).set({ emailFollowUps: 1, followUpOn: null }).where(eq(leads.id, lead.id)),
      ]);
      queued += 1;
    } catch (error) {
      console.error("follow-up e-mail failed", lead.id, error);
    }
  }
  return queued;
}

/** With automatic dispatch on, new leads with an e-mail are drafted and queued. */
export async function autoDispatch(
  deps: { db: Db; analyzer: LeadAnalyzer; fromAddress: string; limit: number },
  now = new Date(),
): Promise<number> {
  const { db } = deps;
  const row = await db.query.settings.findFirst();
  if (!row?.autoDispatch) return 0;
  const remaining = deps.limit - (await requestsToday(db, EMAIL_PROVIDER, now));
  const queuedCount = await db.$count(emails, eq(emails.status, "queued"));
  const room = remaining - queuedCount;
  if (room <= 0) return 0;

  const candidates = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(
        eq(leads.status, "new"),
        eq(leads.analysisStatus, "done"),
        isNotNull(leads.email),
        isNull(leads.unsubscribedAt),
        sql`not exists (select 1 from emails e where e.lead_id = ${leads.id} and e.direction = 'out' and e.status <> 'draft')`,
      ),
    )
    .orderBy(desc(leads.score))
    .limit(room);
  if (candidates.length === 0) return 0;
  const { drafts } = await prepareDrafts(
    deps,
    candidates.map((candidate) => candidate.id),
  );
  return queueDrafts(
    db,
    drafts.map((draft) => draft.id),
    now,
  );
}

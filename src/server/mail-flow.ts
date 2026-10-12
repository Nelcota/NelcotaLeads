import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import {
  analyses,
  apiUsage,
  emails,
  leads,
  searches,
  settings as settingsTable,
  type Analysis,
  type Email,
  type Lead,
} from "@/db/schema";
import type { CallUsage, LeadAnalyzer } from "@/lib/ai";
import { cleanText, ForbiddenPhrasesError } from "@/lib/ai/analyzer";
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
/** Minimum time between two outgoing e-mails, except answers to a message the lead sent. */
export const SEND_GAP_MINUTES = 8;
/**
 * While a row is `queued`, a non-null `sent_at` marks a send in progress (the claim). A claim
 * older than this comes from a run that crashed mid-send and may be taken over; the e-mail may
 * then go out twice, which beats never sending it.
 */
export const CLAIM_TIMEOUT_MINUTES = 10;
// Replies go out after a short pause, like a person reading and answering.
const REPLY_DELAY_MINUTES = 2;
const MAX_AI_REPLIES = 3;
// Parallel model calls when drafting many first e-mails at once.
const DRAFT_CONCURRENCY = 4;
// Longest AI text sent without a person reading it.
const MAX_AUTO_LENGTH = 1200;
export const EMAIL_OPT_OUT = 'Para não receber mais e-mails, responda com "sair".';
const OPTED_OUT = "Pediu para não receber e-mails";
const BLOCKED = "O lead pediu para não receber e-mails";

export function mailDailyLimit(value: string | undefined): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isInteger(n) && n >= 0
    ? n
    : DEFAULT_MAIL_DAILY_LIMIT;
}

/** Body plus signature, and the opt-out line on first contacts and follow-ups. */
/** Cold e-mails always carry the opt-out line, even after the user rewrote the whole draft. */
export function ensureOptOut(body: string): string {
  return body.includes(EMAIL_OPT_OUT)
    ? body
    : `${body.trimEnd()}

${EMAIL_OPT_OUT}`;
}

export function composeBody(text: string, settings: SettingsInput, optOut: boolean): string {
  const signature = [settings.senderName, settings.senderCompany].filter(Boolean).join("\n");
  return [cleanText(text), signature, optOut ? EMAIL_OPT_OUT : ""].filter(Boolean).join("\n\n");
}

function replySubject(subject: string) {
  return /^(re|res|resp):/i.test(subject.trim()) ? subject : `Re: ${subject}`;
}

/** Lowercase, no accents, punctuation as spaces, single spaces. */
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Where the quoted original starts in a reply.
const QUOTE_START = /^(>|-{2,}|_{5,}|(de|from|enviado|sent):\s|em .+ escreveu:?$|on .+ wrote:?$)/i;
const OPT_OUT_PATTERNS: RegExp[] = [
  /^(sair|stop|parar|pare|remover|remova|cancelar|descadastrar|unsubscribe)( por favor| obrigad[oa])?$/,
  /\b(descadastr\w*|unsubscribe)\b/,
  /(?<!nao )\b(quero|queremos|gostaria de|desejo|preciso) (me )?(sair|ser removid[oa]s?|ser excluid[oa]s?)\b/,
  /\b(me|nos) (remova|removam|remover|retire|retirem|tire|tirem|exclua|excluam|descadastre|descadastrem)\b/,
  /\b(remova|removam|retire|retirem|tire|tirem|exclua|excluam) (o )?(meu|nosso|este|esse) (e ?mail|contato|endereco)\b/,
  /\bnao (quero|queremos|desejo|desejamos|gostaria de|gostariamos de) (mais )?receber\b/,
  /\b(parem|pare|parar) de (me |nos )?(enviar|mandar)\b/,
  /\b(remove me|take me off|opt out)\b/,
];
// A line longer than this is a real message that happens to use the words, not an opt-out.
const MAX_OPT_OUT_WORDS = 12;

function optOutLine(line: string) {
  const text = normalize(line);
  if (!text || text.split(" ").length > MAX_OPT_OUT_WORDS) return false;
  return OPT_OUT_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * True when a reply is a short request to stop receiving e-mails. Only the first lines the
 * lead wrote count (never the quoted original, which carries our own "responda com sair").
 */
export function isUnsubscribeRequest(text: string, subject = ""): boolean {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (QUOTE_START.test(line)) break;
    if (line) lines.push(line);
    if (lines.length === 3) break;
  }
  const topic = subject.replace(/^\s*((re|res|resp|fw|fwd|enc)\s*:\s*)+/i, "");
  return lines.some(optOutLine) || optOutLine(topic);
}

const OPT_OUT_REASON =
  /\b(nao (quer|quis|deseja) (mais )?(receber|ser contatad)|pediu para (sair|nao receber|ser removid|parar|descadastr)|descadastr|remov\w* da lista|opt ?out|unsubscribe|parar de receber)/;

/** An AI "close" whose reason is an opt-out in other words. */
export function isOptOutReason(reason: string): boolean {
  return OPT_OUT_REASON.test(normalize(reason));
}

const OUTPUT_CHECKS: [RegExp, string][] = [
  [/https?:\/\/|\bwww\./i, "link"],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/, "endereço de e-mail"],
  [/(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}\b|\d{8,}/, "telefone"],
  [/R\$|\breais\b|\bvalor(?:es)?\b|\bpre[çc]os?\b|\bor[çc]amento\b/i, "preço ou valor"],
];

/** Why AI text cannot go out without a person reading it (empty when it can). */
export function outgoingIssues(text: string): string[] {
  const issues = OUTPUT_CHECKS.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
  return text.length > MAX_AUTO_LENGTH ? ["texto longo demais", ...issues] : issues;
}

/** Fixed messages for the client and the e-mail row; the provider's text only goes to the log. */
export function mailErrorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : "";
  if (/^SMTP login/i.test(text)) return "O servidor SMTP recusou o login.";
  if (/^SMTP destinat/i.test(text)) return "O servidor SMTP recusou o destinatário.";
  if (/^SMTP/i.test(text)) return "O servidor SMTP recusou o envio.";
  if (/^IMAP/i.test(text)) return "Não foi possível conectar ao IMAP.";
  return "Não foi possível conectar ao servidor de e-mail.";
}

function calls(usage: CallUsage) {
  return usage.calls ?? 1;
}

/** Runs fn over items with at most `size` running at once. */
async function forEachLimit<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      if (item !== undefined) await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
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

/** Opt-out is per address: another lead row with the same e-mail is blocked too. */
async function addressUnsubscribed(db: Db, address: string) {
  const rows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(
      and(isNotNull(leads.unsubscribedAt), sql`lower(${leads.email}) = ${address.toLowerCase()}`),
    )
    .limit(1);
  return rows.length > 0;
}

const unsubscribedAddress = sql`exists (select 1 from leads u where u.unsubscribed_at is not null and lower(u.email) = lower(${leads.email}))`;

/** The first item per lead (lists come sorted newest first). */
function firstOf<T extends { leadId: string }>(items: T[]) {
  const map = new Map<string, T>();
  for (const item of items) if (!map.has(item.leadId)) map.set(item.leadId, item);
  return map;
}

export type DraftSkip = { leadId: string; name: string; reason: string };

/**
 * Writes the first e-mail (as a draft) for each selected new lead that can receive one.
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
  const rows =
    leadIds.length > 0 ? await db.select().from(leads).where(inArray(leads.id, leadIds)) : [];
  if (rows.length === 0) return { drafts, skipped };
  const ids = rows.map((lead) => lead.id);
  const [outgoing, analysisRows, searchRows, blockedRows] = await Promise.all([
    db
      .select()
      .from(emails)
      .where(and(inArray(emails.leadId, ids), eq(emails.direction, "out")))
      .orderBy(desc(emails.createdAt)),
    db
      .select()
      .from(analyses)
      .where(inArray(analyses.leadId, ids))
      .orderBy(desc(analyses.createdAt), desc(analyses.id)),
    db
      .select()
      .from(searches)
      .where(inArray(searches.id, [...new Set(rows.map((lead) => lead.searchId))])),
    db
      .select({ id: leads.id })
      .from(leads)
      .where(and(inArray(leads.id, ids), unsubscribedAddress)),
  ]);
  const lastOut = firstOf(outgoing);
  const analysisOf = firstOf(analysisRows);
  const searchOf = new Map(searchRows.map((search) => [search.id, search]));
  const blocked = new Set(blockedRows.map((row) => row.id));

  const toWrite: { lead: Lead; analysis: Analysis }[] = [];
  for (const lead of rows) {
    const skip = (reason: string) => skipped.push({ leadId: lead.id, name: lead.name, reason });
    const existing = lastOut.get(lead.id);
    const analysis = analysisOf.get(lead.id);
    if (!lead.email) skip("sem e-mail no site");
    else if (lead.unsubscribedAt || blocked.has(lead.id)) skip("pediu para não receber");
    else if (existing && existing.status !== "draft") skip("já recebeu e-mail");
    else if (lead.status !== "new") skip("não está mais como novo");
    else if (existing) drafts.push(existing);
    else if (!analysis) skip("ainda em análise");
    else toWrite.push({ lead, analysis });
  }

  const written: Lead[] = [];
  await forEachLimit(toWrite, DRAFT_CONCURRENCY, async ({ lead, analysis }) => {
    try {
      const { email, usage } = await analyzer.writeEmail(
        settings,
        buildContext(lead, searchOf.get(lead.searchId)),
        analysis,
      );
      await recordAiCost(db, calls(usage), usage.cost);
      // Insert-if-absent in one statement: a concurrent run or a status change in the
      // meantime wins and nothing is written.
      await db.run(sql`
        insert into emails (id, lead_id, direction, status, author, from_address, to_address, subject, body)
        select ${crypto.randomUUID()}, ${lead.id}, 'out', 'draft', 'ai', ${deps.fromAddress},
          ${lead.email}, ${email.subject}, ${composeBody(email.body, settings, true)}
        where not exists (select 1 from emails where lead_id = ${lead.id} and direction = 'out')
          and exists (select 1 from leads where id = ${lead.id} and status = 'new' and unsubscribed_at is null)`);
      written.push(lead);
    } catch (error) {
      if (error instanceof ForbiddenPhrasesError) {
        await recordAiCost(db, calls(error.usage), error.usage.cost);
      }
      console.error("email draft failed", lead.id, error);
      skipped.push({
        leadId: lead.id,
        name: lead.name,
        reason: "a IA não conseguiu escrever agora",
      });
    }
  });

  if (written.length > 0) {
    const fresh = firstOf(
      await db
        .select()
        .from(emails)
        .where(
          and(
            inArray(
              emails.leadId,
              written.map((lead) => lead.id),
            ),
            eq(emails.direction, "out"),
          ),
        )
        .orderBy(desc(emails.createdAt)),
    );
    for (const lead of written) {
      const draft = fresh.get(lead.id);
      if (draft?.status === "draft") drafts.push(draft);
      else skipped.push({ leadId: lead.id, name: lead.name, reason: "já recebeu e-mail" });
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
  let written;
  try {
    written = await analyzer.writeEmail(settings, await leadContext(db, lead), analysis);
  } catch (error) {
    if (error instanceof ForbiddenPhrasesError) {
      await recordAiCost(db, calls(error.usage), error.usage.cost);
    }
    console.error("email rewrite failed", emailId, error);
    // No `cause`: the provider's text must not reach the client (it is logged above).
    // oxlint-disable-next-line eslint/preserve-caught-error
    throw new Error("A IA não conseguiu reescrever agora. Tente de novo.");
  }
  await recordAiCost(db, calls(written.usage), written.usage.cost);
  await db
    .update(emails)
    .set({
      subject: written.email.subject,
      body: composeBody(written.email.body, settings, true),
    })
    .where(and(eq(emails.id, emailId), eq(emails.status, "draft")));
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
  const [first, ...rest] = drafts.map((draft, index) =>
    db
      .update(emails)
      .set({ status: "queued", sendAfter: new Date(start + index * gap) })
      // A draft deleted or sent in the meantime is left alone.
      .where(and(eq(emails.id, draft.id), eq(emails.status, "draft")))
      .returning({ id: emails.id }),
  );
  if (first === undefined) return 0;
  const results = await db.batch([first, ...rest]);
  return results.reduce((total, rows) => total + rows.length, 0);
}

/**
 * Queued rows that may be sent now: due, not claimed by a running send (or claimed so long
 * ago that it crashed), and outside the gap after the last outgoing e-mail. Answers to a
 * message the lead sent (in_reply_to set) skip the gap: the person is waiting, and their
 * volume is bounded by the inbound mail.
 */
function sendable(now: Date) {
  const staleBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MINUTES * 60_000);
  const gapStart = Math.floor((now.getTime() - SEND_GAP_MINUTES * 60_000) / 1000);
  return and(
    eq(emails.status, "queued"),
    lte(emails.sendAfter, now),
    or(isNull(emails.sentAt), lt(emails.sentAt, staleBefore)),
    or(
      isNotNull(emails.inReplyTo),
      sql`not exists (select 1 from emails recent where recent.direction = 'out' and recent.status in ('sent', 'queued') and recent.sent_at > ${gapStart})`,
    ),
  );
}

/** Atomically claims one queued e-mail; undefined when another run got it first. */
async function claim(db: Db, emailId: string, now: Date) {
  const [row] = await db
    .update(emails)
    .set({ sentAt: now })
    .where(and(eq(emails.id, emailId), sendable(now)))
    .returning();
  return row;
}

async function failEmail(db: Db, emailId: string, error: string) {
  await db
    .update(emails)
    .set({ status: "failed", sentAt: null, error })
    .where(eq(emails.id, emailId));
}

/**
 * Sends one queued e-mail now: claims it (unless the caller inserted it already claimed),
 * then checks the lead, the daily limit and adds the threading headers.
 */
export async function sendEmail(
  deps: { db: Db; mailer: Mailer; limit: number },
  email: Email,
  now = new Date(),
  options: { claimed?: boolean } = {},
): Promise<"sent" | "limit" | "failed" | "skipped"> {
  const { db, mailer } = deps;
  const row = options.claimed ? email : await claim(db, email.id, now);
  if (!row) return "skipped";
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, row.leadId) });
  if (!lead || lead.unsubscribedAt || (await addressUnsubscribed(db, row.toAddress))) {
    await failEmail(db, row.id, BLOCKED);
    return "failed";
  }
  if (row.author === "ai" && !lead.aiMode) {
    await failEmail(db, row.id, "Cancelado: a conversa passou para você");
    return "failed";
  }
  if (!(await reserveRequest(db, EMAIL_PROVIDER, deps.limit, now))) {
    // Back in the queue for tomorrow.
    await db.update(emails).set({ sentAt: null }).where(eq(emails.id, row.id));
    return "limit";
  }

  const previous = await thread(db, lead.id);
  const references = previous.flatMap((item) => (item.messageId ? [item.messageId] : []));
  const messageId = newMessageId(mailer.address);
  try {
    await mailer.send({
      from: { address: mailer.address, name: (await loadSettings(db)).senderName || undefined },
      to: row.toAddress,
      subject: row.subject,
      text: row.body,
      messageId,
      inReplyTo: row.inReplyTo ?? references.at(-1) ?? null,
      references,
      unsubscribe: mailer.address,
      date: now,
    });
  } catch (error) {
    console.error("email send failed", row.id, error);
    await db.batch([
      db
        .update(emails)
        .set({ status: "failed", sentAt: null, error: mailErrorMessage(error) })
        .where(eq(emails.id, row.id)),
      // Nothing went out, so the day's quota gets its slot back.
      db
        .update(apiUsage)
        .set({ requests: sql`${apiUsage.requests} - 1` })
        .where(
          and(
            eq(apiUsage.day, localDay(now)),
            eq(apiUsage.provider, EMAIL_PROVIDER),
            gt(apiUsage.requests, 0),
          ),
        ),
    ]);
    return "failed";
  }

  await db
    .update(emails)
    .set({ status: "sent", sentAt: now, messageId, fromAddress: mailer.address, error: null })
    .where(eq(emails.id, row.id));
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
    where: sendable(now),
    orderBy: [asc(emails.sendAfter)],
  });
  if (!next) return 0;
  // A concurrent run that claimed it first sends it; this one does nothing.
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

  // One bad message must not lose the others. A crash before the cursor is saved reads the
  // batch again; stored Message-IDs make that harmless.
  let handled = 0;
  for (const message of messages) {
    try {
      if (await handleInbound(deps, message, now)) handled += 1;
    } catch (error) {
      console.error("inbound e-mail failed", message.messageId, error);
    }
  }

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
  return handled;
}

/**
 * The lead a message belongs to. `inThread` is true only when it answers one of our own
 * Message-IDs; a match on the From header alone can be forged.
 */
async function findLead(
  db: Db,
  message: IncomingEmail,
): Promise<{ lead: Lead; inThread: boolean } | undefined> {
  const ids = [message.inReplyTo, ...message.references.slice(-20)].filter((id): id is string =>
    Boolean(id),
  );
  if (ids.length > 0) {
    const known = await db.query.emails.findFirst({
      where: and(inArray(emails.messageId, ids), eq(emails.direction, "out")),
    });
    const lead = known && (await db.query.leads.findFirst({ where: eq(leads.id, known.leadId) }));
    if (lead) return { lead, inThread: true };
  }
  const lead = await db.query.leads.findFirst({
    where: sql`lower(${leads.email}) = ${message.from.toLowerCase()}`,
  });
  return lead ? { lead, inThread: false } : undefined;
}

async function unsubscribe(db: Db, leadId: string, now: Date) {
  await db.batch([
    db
      .update(leads)
      .set({
        unsubscribedAt: now,
        status: "discarded",
        aiMode: false,
        handoffReason: null,
        followUpOn: null,
        discardReason: OPTED_OUT,
        lastEmailAt: now,
      })
      .where(eq(leads.id, leadId)),
    db
      .update(emails)
      .set({ status: "failed", error: "Cancelado: o lead pediu para não receber" })
      .where(and(eq(emails.leadId, leadId), inArray(emails.status, ["queued", "draft"]))),
  ]);
}

/** Cancels the AI's queued e-mails (follow-up, pending reply) for one lead. */
export async function cancelQueuedAi(db: Db, leadId: string, reason: string) {
  await db
    .update(emails)
    .set({ status: "failed", error: reason })
    .where(and(eq(emails.leadId, leadId), eq(emails.status, "queued"), eq(emails.author, "ai")));
}

/** Stores a reply and decides what happens next. Returns false when it is not ours. */
export async function handleInbound(
  deps: { db: Db; mailer: Mailer; analyzer: LeadAnalyzer },
  message: IncomingEmail,
  now = new Date(),
): Promise<boolean> {
  const { db, mailer, analyzer } = deps;
  if (!message.from || message.from.toLowerCase() === mailer.address) return false;
  const match = await findLead(db, message);
  if (!match) return false;
  const { lead, inThread } = match;

  // The unique Message-ID index makes this the dedupe: an overlapping poll inserts nothing.
  const stored = await db
    .insert(emails)
    .values({
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
    })
    .onConflictDoNothing()
    .returning({ id: emails.id });
  if (stored.length === 0) return false;
  // Out-of-office and bounces are kept in the thread but change nothing.
  if (message.automatic) return true;

  if (isUnsubscribeRequest(message.text, message.subject)) {
    await unsubscribe(db, lead.id, now);
    return true;
  }

  // Any real answer makes the queued follow-up (or an older pending AI reply) obsolete.
  await cancelQueuedAi(db, lead.id, "Cancelado: o lead respondeu");
  if (lead.unsubscribedAt) {
    // Kept in the thread, but an opted-out lead is not reopened.
    await db.update(leads).set({ lastEmailAt: now }).where(eq(leads.id, lead.id));
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

  if (!inThread) {
    await handOff(db, lead.id, "Resposta sem vínculo com o e-mail enviado; confira o remetente");
    return true;
  }

  const [settings, row] = await Promise.all([
    loadSettings(db),
    db.query.settings.findFirst({ columns: { aiAutoReply: true } }),
  ]);
  if (!(row?.aiAutoReply ?? true) || !lead.aiMode || !hasOffer(settings)) {
    await handOff(db, lead.id, lead.handoffReason ?? "Respondeu");
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
  const base = {
    leadId: lead.id,
    direction: "out" as const,
    author: "ai" as const,
    fromAddress: mailer.address,
    toAddress: lead.email ?? message.from,
    subject: replySubject(message.subject),
    inReplyTo: message.messageId,
  };
  // Kept without signature: it is added when the person sends it.
  const leaveDraft = (text: string) =>
    db.insert(emails).values({ ...base, id: crypto.randomUUID(), status: "draft", body: text });
  try {
    const { decision, usage } = await analyzer.replyEmail(
      settings,
      await leadContext(db, lead),
      conversation,
    );
    await recordAiCost(db, calls(usage), usage.cost);
    if (decision.action === "reply" && decision.reply) {
      const issues = outgoingIssues(decision.reply);
      if (issues.length > 0) {
        await handOff(db, lead.id, `Resposta da IA para revisar: ${issues.join(", ")}`);
        await leaveDraft(cleanText(decision.reply));
      } else {
        await db.insert(emails).values({
          ...base,
          id: crypto.randomUUID(),
          status: "queued",
          body: composeBody(decision.reply, settings, false),
          sendAfter: new Date(now.getTime() + REPLY_DELAY_MINUTES * 60_000),
        });
      }
    } else if (decision.action === "close") {
      if (isOptOutReason(decision.reason)) {
        await unsubscribe(db, lead.id, now);
      } else {
        await db.batch([
          db
            .update(leads)
            .set({
              status: "discarded",
              aiMode: false,
              discardReason: decision.reason,
              discardedAt: now,
            })
            .where(eq(leads.id, lead.id)),
          db
            .update(emails)
            .set({ status: "failed", error: "Cancelado: conversa encerrada" })
            .where(and(eq(emails.leadId, lead.id), inArray(emails.status, ["queued", "draft"]))),
        ]);
      }
    } else {
      await handOff(db, lead.id, decision.reason);
      if (decision.draft) await leaveDraft(cleanText(decision.draft));
    }
  } catch (error) {
    console.error("email reply failed", lead.id, error);
    if (error instanceof ForbiddenPhrasesError) {
      await recordAiCost(db, calls(error.usage), error.usage.cost);
      await handOff(db, lead.id, "Resposta da IA para revisar: frases proibidas");
      await leaveDraft(cleanText(error.text));
    } else {
      await handOff(db, lead.id, "A IA não conseguiu responder");
    }
  }
  return true;
}

async function handOff(db: Db, leadId: string, reason: string) {
  await db
    .update(leads)
    .set({ aiMode: false, handoffReason: reason.slice(0, 300) })
    .where(eq(leads.id, leadId));
  await cancelQueuedAi(db, leadId, "Cancelado: a conversa passou para você");
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
    // Claimed before the (slow, paid) AI call, so an overlapping tick skips this lead.
    const claimed = await db
      .update(leads)
      .set({ emailFollowUps: 1 })
      .where(and(eq(leads.id, lead.id), eq(leads.emailFollowUps, 0)))
      .returning({ id: leads.id });
    if (claimed.length === 0) continue;
    try {
      const sentOn = first.sentAt ? localDay(first.sentAt) : today;
      const { message, usage } = await analyzer.writeFollowUp(
        settings,
        await leadContext(db, lead),
        { firstMessage: first.body, daysSince: Math.max(1, dayDiff(sentOn, today)) },
      );
      await recordAiCost(db, calls(usage), usage.cost);
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
        db.update(leads).set({ followUpOn: null }).where(eq(leads.id, lead.id)),
      ]);
      queued += 1;
    } catch (error) {
      console.error("follow-up e-mail failed", lead.id, error);
      if (error instanceof ForbiddenPhrasesError) {
        // Kept claimed: no follow-up beats one with forbidden phrases or paying every tick.
        await recordAiCost(db, calls(error.usage), error.usage.cost);
      } else {
        await db.update(leads).set({ emailFollowUps: 0 }).where(eq(leads.id, lead.id));
      }
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
        sql`not ${unsubscribedAddress}`,
        sql`not exists (select 1 from emails e where e.lead_id = ${leads.id} and e.direction = 'out' and e.status <> 'draft')`,
      ),
    )
    // Leads that already have a draft go last: a draft held for review must not take the
    // slots of fresh leads on every tick, or nothing would ever be sent.
    .orderBy(
      sql`exists (select 1 from emails e where e.lead_id = ${leads.id} and e.direction = 'out')`,
      desc(leads.score),
    )
    .limit(room);
  if (candidates.length === 0) return 0;
  const { drafts } = await prepareDrafts(
    deps,
    candidates.map((candidate) => candidate.id),
  );
  // Nobody reviews these, so anything the AI should not say alone stays a draft for review.
  const ready = drafts.filter(
    (draft) => outgoingIssues(`${draft.subject}\n${draft.body}`).length === 0,
  );
  return queueDrafts(
    db,
    ready.map((draft) => draft.id),
    now,
  );
}

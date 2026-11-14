import { EMAIL_OPT_OUT } from "@/lib/email-opt-out";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQLWrapper,
} from "drizzle-orm";
import type { Db } from "@/db/client";
import { inList } from "@/db/in-list";
import {
  analyses,
  emails,
  leads,
  proposals,
  searches,
  settings as settingsTable,
  type Analysis,
  type Email,
  type Lead,
} from "@/db/schema";
import type { CallUsage, LeadAnalyzer } from "@/lib/ai";
import { cleanText, ForbiddenPhrasesError } from "@/lib/ai/analyzer";
import type { ThreadMessage } from "@/lib/ai/prompts";
import { brazilInstant, dayDiff, localDay } from "@/lib/format";
import { newMessageId, type IncomingEmail, type Mailer } from "@/lib/mail";
import { coldSendingOpen, compareByScore, sendSlots, type ScoredItem } from "@/lib/send-window";
import { DEFAULT_MAIL_DAILY_LIMIT, SEND_GAP_MINUTES, type SettingsInput } from "@/lib/schemas";

// Shared with the screens that describe the sending pace.
export { DEFAULT_MAIL_DAILY_LIMIT, SEND_GAP_MINUTES };
import { leadPatch, outcomeReset } from "./lead-status";
import { buildContext, hasOffer, NO_OFFER_MESSAGE } from "./process-lead";
import { isSalesEmail, SALES_EMAILS_OFF_REASON } from "./sales-mail";
import { DEFAULT_SETTINGS, loadDispatchControl, loadSettings } from "./settings-store";
import {
  dailyLimit,
  recordAiCost,
  releaseRequestQuery,
  requestsToday,
  reserveRequest,
} from "./usage";

export const EMAIL_PROVIDER = "email";
/**
 * While a row is `queued`, a non-null `sent_at` marks a send in progress (the claim). A claim
 * older than this comes from a run that crashed mid-send and may be taken over; the e-mail may
 * then go out twice, which beats never sending it.
 */
export const CLAIM_TIMEOUT_MINUTES = 10;
// Replies go out after a short pause, like a person reading and answering.
const REPLY_DELAY_MINUTES = 2;
const MAX_AI_REPLIES = 3;
/**
 * Answers the AI may queue in one conversation, sent or not. A lead who writes again before the
 * queued answer goes out cancels it (and gets a new one), so the sent count alone never stops a
 * fast back-and-forth, or two auto-responders, from paying for a model call per message.
 */
const MAX_AI_REPLY_ATTEMPTS = 6;
/**
 * Room kept in the daily limit for conversation e-mails (AI answers, what a person writes):
 * cold outreach (first e-mails, follow-ups) stops at `limit - reserve`, so a lead who answers
 * late in the day still gets a reply. The reserve is 10 e-mails, or 20% of the limit when that
 * is smaller (a limit of 30 keeps 6). Conversation e-mails may use the whole limit.
 */
export const REPLY_RESERVE = 10;
const REPLY_RESERVE_SHARE = 0.2;

/** How many e-mails of the daily `limit` cold outreach may use. */
export function coldDailyLimit(limit: number): number {
  const reserve = Math.min(REPLY_RESERVE, Math.floor(limit * REPLY_RESERVE_SHARE));
  return Math.max(0, limit - reserve);
}

/**
 * What today's cold outreach still has room for: the cold share of the daily `limit`, the
 * e-mails already sent today (any kind, as the send loop counts them) and the cold e-mails
 * already queued. Read only.
 */
export async function loadColdRoom(db: Db, limit: number, now = new Date()) {
  const [sentToday, queuedCold] = await Promise.all([
    requestsToday(db, EMAIL_PROVIDER, now),
    db.$count(emails, and(eq(emails.status, "queued"), isNull(emails.sentAt), isColdOutreach)),
  ]);
  return { coldLimit: coldDailyLimit(limit), sentToday, queuedCold };
}

/** First e-mails one automatic dispatch run may draft. */
export const AUTO_DISPATCH_PER_RUN = 20;
// Parallel model calls when drafting many first e-mails at once.
const DRAFT_CONCURRENCY = 4;
// Longest AI text sent without a person reading it.
const MAX_AUTO_LENGTH = 1200;
export { EMAIL_OPT_OUT };
const OPTED_OUT = "Pediu para não receber e-mails";
const BLOCKED = "O lead pediu para não receber e-mails";
/** The user's own reply in progress: at most one per lead, and the AI never writes over it. */
export function userDraftOf(leadId: string) {
  return and(eq(emails.leadId, leadId), eq(emails.status, "draft"), eq(emails.author, "user"));
}

/**
 * Inserts an outgoing draft unless the lead already has one the user wrote, in a single
 * statement, so two writers racing still leave at most one user draft per lead.
 */
export function insertDraftUnlessUserHasOne(
  db: Db,
  draft: {
    leadId: string;
    author: "ai" | "user";
    fromAddress: string;
    toAddress: string;
    subject: string;
    body: string;
    inReplyTo: string | null;
  },
) {
  return db.run(sql`
    insert into emails (id, lead_id, direction, status, author, from_address, to_address, subject, body, in_reply_to)
    select ${crypto.randomUUID()}, ${draft.leadId}, 'out', 'draft', ${draft.author}, ${draft.fromAddress},
      ${draft.toAddress}, ${draft.subject}, ${draft.body}, ${draft.inReplyTo}
    where not exists (select 1 from emails where lead_id = ${draft.leadId} and status = 'draft' and author = 'user')`);
}

async function hasUserDraft(db: Db, leadId: string) {
  const rows = await db.select({ id: emails.id }).from(emails).where(userDraftOf(leadId)).limit(1);
  return rows.length > 0;
}

const USER_DRAFT_REASON = "Você já começou uma resposta";

/** Reason kept on the e-mails a closed conversation cancelled; undoing the close looks for it. */
export const CLOSED_REASON = "Cancelado: conversa encerrada";
export const DISCARDED_REASON = "Cancelado: lead descartado";
/** Reason kept on the first e-mails "Cancelar disparo" took out of the queue. */
export const DISPATCH_CANCELLED_REASON = "Cancelado: disparo do dia cancelado";

/**
 * A first e-mail cancelled before it went out because the lead was discarded or the day's run
 * was cancelled. Nothing reached the lead, so it is drafted again as if never contacted.
 * `table` is the emails table's name or alias in the query.
 */
const cancelledByDiscard = (table = "emails") =>
  sql`(${sql.raw(table)}.status = 'cancelled' and coalesce(${sql.raw(table)}.error, '') in (${DISCARDED_REASON}, ${DISPATCH_CANCELLED_REASON}))`;

/**
 * First e-mails and follow-ups the AI wrote: the cold outreach that obeys the send window and
 * the pause. Everything else in the queue is part of an ongoing conversation (an AI answer to
 * a message the lead sent, or anything a person wrote) and keeps going at any hour: the lead is
 * waiting for it, and its volume is bounded by the inbound mail.
 */
export const isColdOutreach = sql`(${emails.author} = 'ai' and ${emails.inReplyTo} is null and ${emails.conversationReply} = 0)`;

/** A cold e-mail to a lead nobody e-mailed yet: a first e-mail, not a follow-up. */
export const isFirstOutreach = sql`(${isColdOutreach} and not exists (
  select 1 from emails done where done.lead_id = emails.lead_id and done.direction = 'out'
    and done.status = 'sent'))`;

/** Whether the lead in `leadId` (a column) was already written to. */
export const wasContacted = (leadId: SQLWrapper) => sql`exists (
  select 1 from emails e where e.lead_id = ${leadId} and e.direction = 'out' and e.status <> 'draft'
    and not ${cancelledByDiscard("e")})`;

export function mailDailyLimit(value: string | undefined): number {
  return dailyLimit(value, DEFAULT_MAIL_DAILY_LIMIT);
}

/** Cold e-mails always carry the opt-out line, even after the user rewrote the whole draft. */
export function ensureOptOut(body: string): string {
  return body.includes(EMAIL_OPT_OUT)
    ? body
    : `${body.trimEnd()}

${EMAIL_OPT_OUT}`;
}

/** Body plus signature, and the opt-out line on first contacts and follow-ups. */
export function composeBody(text: string, settings: SettingsInput, optOut: boolean): string {
  const signature = [settings.senderName, settings.senderCompany].filter(Boolean).join("\n");
  return [cleanText(text), signature, optOut ? EMAIL_OPT_OUT : ""].filter(Boolean).join("\n\n");
}

/** The text a person wrote, without what composeBody added (signature, opt-out line). */
export function stripComposed(body: string, settings: SettingsInput): string {
  let text = body;
  const optOut = `\n\n${EMAIL_OPT_OUT}`;
  if (text.endsWith(optOut)) text = text.slice(0, -optOut.length);
  const signature = [settings.senderName, settings.senderCompany].filter(Boolean).join("\n");
  if (signature && text.endsWith(`\n\n${signature}`)) {
    text = text.slice(0, -(signature.length + 2));
  }
  return text;
}

export function replySubject(subject: string) {
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

export async function leadContext(db: Db, lead: Lead) {
  const search = await db.query.searches.findFirst({ where: eq(searches.id, lead.searchId) });
  return buildContext(lead, search);
}

/**
 * Sent and received e-mails of a lead, oldest first: what the AI reads as the conversation.
 * Machine mail (out-of-office, auto-replies) is left out: nobody wrote it.
 */
export function thread(db: Db, leadId: string) {
  return db
    .select()
    .from(emails)
    .where(
      and(
        eq(emails.leadId, leadId),
        inArray(emails.status, ["sent", "received"]),
        eq(emails.automatic, false),
      ),
    )
    .orderBy(asc(emails.createdAt), asc(emails.sentAt));
}

/** Opt-out is per address: another lead row with the same e-mail is blocked too. */
export async function addressUnsubscribed(db: Db, address: string) {
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

/** Why a selected lead gets no first e-mail, or null when it may get one. */
function draftBlocker(lead: Lead, existing: Email | undefined, blocked: boolean): string | null {
  if (!lead.email) return "sem e-mail no site";
  if (lead.unsubscribedAt || blocked) return "pediu para não receber";
  if (existing && existing.status !== "draft") return "já recebeu e-mail";
  // A reply in progress is never sent as a first e-mail.
  if (existing && (existing.inReplyTo || existing.author === "user")) return "já está em conversa";
  if (lead.status !== "new") return "não está mais como novo";
  return null;
}

type DraftContext = {
  rows: Lead[];
  /** The latest outgoing e-mail per lead, ignoring the ones cancelled by a discard. */
  lastOut: Map<string, Email>;
  /** Leads whose address asked not to receive e-mails (on this or another lead). */
  blocked: Set<string>;
};

/**
 * Read-only: the selected leads with what decides whether they may get a first e-mail. Shared
 * by `prepareDrafts` and `findReusableDrafts`, so both judge a lead the same way.
 */
async function loadDraftContext(db: Db, leadIds: string[]): Promise<DraftContext> {
  const rows =
    leadIds.length > 0 ? await db.select().from(leads).where(inList(leads.id, leadIds)) : [];
  if (rows.length === 0) return { rows, lastOut: new Map(), blocked: new Set() };
  const ids = rows.map((lead) => lead.id);
  const [outgoing, blockedRows] = await Promise.all([
    db
      .select()
      .from(emails)
      .where(
        and(
          inList(emails.leadId, ids),
          eq(emails.direction, "out"),
          sql`not ${cancelledByDiscard()}`,
        ),
      )
      .orderBy(desc(emails.createdAt)),
    db
      .select({ id: leads.id })
      .from(leads)
      .where(and(inList(leads.id, ids), unsubscribedAddress)),
  ]);
  return {
    rows,
    lastOut: firstOf(outgoing),
    blocked: new Set(blockedRows.map((row) => row.id)),
  };
}

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
  const { rows, lastOut, blocked } = await loadDraftContext(db, leadIds);
  if (rows.length === 0) return { drafts, skipped };
  const ids = rows.map((lead) => lead.id);
  const [analysisRows, searchRows] = await Promise.all([
    db
      .select()
      .from(analyses)
      .where(inList(analyses.leadId, ids))
      .orderBy(desc(analyses.createdAt), desc(analyses.id)),
    db
      .select()
      .from(searches)
      .where(inList(searches.id, [...new Set(rows.map((lead) => lead.searchId))])),
  ]);
  const analysisOf = firstOf(analysisRows);
  const searchOf = new Map(searchRows.map((search) => [search.id, search]));

  const toWrite: { lead: Lead; analysis: Analysis }[] = [];
  for (const lead of rows) {
    const skip = (reason: string) => skipped.push({ leadId: lead.id, name: lead.name, reason });
    const existing = lastOut.get(lead.id);
    const analysis = analysisOf.get(lead.id);
    const blocker = draftBlocker(lead, existing, blocked.has(lead.id));
    if (blocker) {
      skip(blocker);
      continue;
    }
    if (existing) {
      drafts.push(existing);
      continue;
    }
    if (!analysis) {
      skip("ainda em análise");
      continue;
    }
    toWrite.push({ lead, analysis });
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
        where not exists (select 1 from emails where lead_id = ${lead.id} and direction = 'out'
            and not ${cancelledByDiscard()})
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
            inList(
              emails.leadId,
              written.map((lead) => lead.id),
            ),
            eq(emails.direction, "out"),
            sql`not ${cancelledByDiscard()}`,
          ),
        )
        .orderBy(desc(emails.createdAt)),
    );
    for (const lead of written) {
      const draft = fresh.get(lead.id);
      if (draft?.status === "draft") {
        drafts.push(draft);
        continue;
      }
      skipped.push({ leadId: lead.id, name: lead.name, reason: "já recebeu e-mail" });
    }
  }
  return { drafts, skipped };
}

/**
 * The first-e-mail drafts `prepareDrafts` would reuse for these leads, read only: no AI call,
 * nothing written. Opening the review shows them before anyone asks the AI for the rest.
 */
export async function findReusableDrafts(db: Db, leadIds: string[]): Promise<Email[]> {
  const { rows, lastOut, blocked } = await loadDraftContext(db, leadIds);
  return rows.flatMap((lead) => {
    const existing = lastOut.get(lead.id);
    if (!existing) return [];
    if (draftBlocker(lead, existing, blocked.has(lead.id))) return [];
    return [existing];
  });
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

type QueueRow = ScoredItem & { status: Email["status"] };

/**
 * The selected drafts plus the cold e-mails already waiting in the queue (not claimed by a
 * running send), with their lead's score: the whole cold queue, to be put in score order.
 */
function coldQueueRows(db: Db, draftIds: string[]): Promise<QueueRow[]> {
  return db
    .select({
      id: emails.id,
      status: emails.status,
      score: leads.score,
      createdAt: leads.createdAt,
    })
    .from(emails)
    .innerJoin(leads, eq(leads.id, emails.leadId))
    .where(
      and(
        // Only cold e-mails: replies go out through the conversation, never this queue.
        isColdOutreach,
        or(
          and(inList(emails.id, draftIds), eq(emails.status, "draft")),
          and(eq(emails.status, "queued"), isNull(emails.sentAt)),
        ),
      ),
    );
}

/** The first free slot: now, or one gap after the last e-mail that went out (or is going). */
async function queueStart(db: Db, now: Date): Promise<Date> {
  const [last] = await db
    .select({ at: sql<number | null>`max(${emails.sentAt})` })
    .from(emails)
    .where(and(eq(emails.direction, "out"), inArray(emails.status, ["sent", "queued"])));
  const lastAt = last?.at ? last.at * 1000 + SEND_GAP_MINUTES * 60_000 : 0;
  return new Date(Math.max(now.getTime(), lastAt));
}

/**
 * Puts drafts in the send queue. The whole cold queue (these drafts and the first e-mails and
 * follow-ups already waiting) gets new slots in score order, highest first, one gap apart and
 * always inside the send window, so the day's run reaches the best leads first.
 */
export async function queueDrafts(db: Db, emailIds: string[], now = new Date()) {
  if (emailIds.length === 0) return 0;
  return slotColdQueue(db, emailIds, now);
}

/**
 * New slots for the cold e-mails already waiting, after the send window changed: the same
 * order and spacing as `queueDrafts`, inside the new hours.
 */
export async function reslotColdQueue(db: Db, now = new Date()): Promise<void> {
  await slotColdQueue(db, [], now);
}

/**
 * Slots the cold queue plus the drafts in `draftIds` (none when only re-slotting). Returns how
 * many drafts were queued.
 */
async function slotColdQueue(db: Db, draftIds: string[], now: Date) {
  const [rows, control, start] = await Promise.all([
    coldQueueRows(db, draftIds),
    loadDispatchControl(db),
    queueStart(db, now),
  ]);
  if (draftIds.length > 0 && !rows.some((row) => row.status === "draft")) return 0;
  const ordered = rows.toSorted(compareByScore);
  const slots = sendSlots(start, ordered.length, SEND_GAP_MINUTES * 60_000, control);
  const updates = ordered.map((row, index) => {
    const isDraft = row.status === "draft";
    return {
      isDraft,
      query: db
        .update(emails)
        .set({ status: "queued", sendAfter: slots[index] ?? start })
        // A draft deleted or sent in the meantime, or a queued e-mail a send already claimed,
        // is left alone.
        .where(
          and(
            eq(emails.id, row.id),
            isDraft
              ? eq(emails.status, "draft")
              : and(eq(emails.status, "queued"), isNull(emails.sentAt)),
          ),
        )
        .returning({ id: emails.id }),
    };
  });
  const [first, ...rest] = updates.map((update) => update.query);
  if (first === undefined) return 0;
  const results = await db.batch([first, ...rest]);
  return results.reduce(
    (total, rowsUpdated, index) => (updates[index]?.isDraft ? total + rowsUpdated.length : total),
    0,
  );
}

/**
 * Queued rows that may be sent now: due, not claimed by a running send (or claimed so long
 * ago that it crashed), and outside the gap after the last outgoing e-mail. Answers to a
 * message the lead sent (in_reply_to set) skip the gap: the person is waiting, and their
 * volume is bounded by the inbound mail. With `coldAllowed` false (outside the send window,
 * or the run is paused) only e-mails of an ongoing conversation qualify; cold ones wait.
 */
function sendable(now: Date, coldAllowed: boolean) {
  const staleBefore = new Date(now.getTime() - CLAIM_TIMEOUT_MINUTES * 60_000);
  const gapStart = Math.floor((now.getTime() - SEND_GAP_MINUTES * 60_000) / 1000);
  return and(
    eq(emails.status, "queued"),
    lte(emails.sendAfter, now),
    or(isNull(emails.sentAt), lt(emails.sentAt, staleBefore)),
    or(
      isNotNull(emails.inReplyTo),
      eq(emails.conversationReply, true),
      sql`not exists (select 1 from emails recent where recent.direction = 'out' and recent.status in ('sent', 'queued') and recent.sent_at > ${gapStart})`,
    ),
    coldAllowed ? undefined : sql`not ${isColdOutreach}`,
  );
}

/** Atomically claims one queued e-mail; undefined when another run got it first. */
async function claim(db: Db, emailId: string, now: Date, coldAllowed: boolean) {
  const [row] = await db
    .update(emails)
    .set({ sentAt: now })
    .where(and(eq(emails.id, emailId), sendable(now, coldAllowed)))
    .returning();
  return row;
}

/** Stopped on purpose (not a send failure), so it is never offered for a retry. */
async function cancelEmail(db: Db, emailId: string, reason: string) {
  await db
    .update(emails)
    .set({ status: "cancelled", sentAt: null, error: reason })
    .where(eq(emails.id, emailId));
}

/**
 * What a send needs. `salesEmails` is SALES_EMAILS_ENABLED: without it (the default) a queued
 * meeting invite or proposal is cancelled instead of sent.
 */
export type SendDeps = { db: Db; mailer: Mailer; limit: number; salesEmails?: boolean };

/**
 * Sends one queued e-mail now: claims it (unless the caller inserted it already claimed),
 * then checks the lead, the daily limit and adds the threading headers.
 */
export async function sendEmail(
  deps: SendDeps,
  email: Email,
  now = new Date(),
  options: { claimed?: boolean; coldAllowed?: boolean } = {},
): Promise<"sent" | "limit" | "failed" | "skipped"> {
  const { db, mailer } = deps;
  const row = options.claimed ? email : await claim(db, email.id, now, options.coldAllowed ?? true);
  if (!row) return "skipped";
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, row.leadId) });
  if (!lead || lead.unsubscribedAt || (await addressUnsubscribed(db, row.toAddress))) {
    await cancelEmail(db, row.id, BLOCKED);
    return "failed";
  }
  // Discarded or closed after it was queued (lead panel, bulk change, another tab).
  if (lead.status === "closed" || lead.status === "discarded") {
    await cancelEmail(db, row.id, lead.status === "closed" ? CLOSED_REASON : DISCARDED_REASON);
    return "failed";
  }
  if (row.author === "ai" && !lead.aiMode) {
    await cancelEmail(db, row.id, "Cancelado: a conversa passou para você");
    return "failed";
  }
  // The kill switch applies to what is already queued, not only to new invites and proposals.
  if (row.author === "user" && !deps.salesEmails && (await isSalesEmail(db, row.id))) {
    await cancelEmail(db, row.id, SALES_EMAILS_OFF_REASON);
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
        // The attempt time goes in `sendAfter`: an e-mail carried over from yesterday that
        // fails today shows up in today's "Falharam" and "Últimos envios".
        .set({ status: "failed", sentAt: null, sendAfter: now, error: mailErrorMessage(error) })
        .where(eq(emails.id, row.id)),
      // Nothing went out, so the day's quota gets its slot back.
      releaseRequestQuery(db, EMAIL_PROVIDER, now),
    ]);
    return "failed";
  }

  await db.batch([
    db
      .update(emails)
      .set({ status: "sent", sentAt: now, messageId, fromAddress: mailer.address, error: null })
      .where(eq(emails.id, row.id)),
    // A proposal counts as sent only once its e-mail actually went out.
    db
      .update(proposals)
      .set({ sentAt: now })
      .where(and(eq(proposals.emailId, row.id), isNull(proposals.sentAt))),
  ]);
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

/**
 * One e-mail per tick from the queue, so sends stay spaced out. Earliest slot first (the
 * slots are in score order), then the oldest row, so the pick is always the same. Outside the
 * send window, while the run is paused or once cold outreach used its share of the daily limit,
 * only e-mails of an ongoing conversation go out.
 */
export async function sendDue(deps: SendDeps, now = new Date()) {
  const { db } = deps;
  const sentToday = await requestsToday(db, EMAIL_PROVIDER, now);
  if (sentToday >= deps.limit) return 0;
  // Past the cold share of the limit only conversation e-mails go out (see REPLY_RESERVE).
  const coldAllowed =
    sentToday < coldDailyLimit(deps.limit) && coldSendingOpen(await loadDispatchControl(db), now);
  const next = await db.query.emails.findFirst({
    where: sendable(now, coldAllowed),
    orderBy: [asc(emails.sendAfter), asc(emails.createdAt), asc(emails.id)],
  });
  if (!next) return 0;
  // A concurrent run that claimed it first sends it; this one does nothing.
  return (await sendEmail(deps, next, now, { coldAllowed })) === "sent" ? 1 : 0;
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

/**
 * The e-mail a bounce reports as not delivered: the one whose Message-ID the report quotes (or
 * answers), or else the latest one sent to an address the report says failed.
 */
export async function findBouncedEmail(
  db: Db,
  message: Pick<IncomingEmail, "inReplyTo" | "references" | "bounce">,
): Promise<Email | undefined> {
  const report = message.bounce;
  if (!report) return undefined;
  const ids = [...report.messageIds, message.inReplyTo, ...message.references.slice(-20)].filter(
    (id): id is string => Boolean(id),
  );
  if (ids.length > 0) {
    const quoted = await db.query.emails.findFirst({
      where: and(inArray(emails.messageId, ids), eq(emails.direction, "out")),
    });
    if (quoted) return quoted;
  }
  if (report.recipients.length === 0) return undefined;
  return db.query.emails.findFirst({
    where: and(
      eq(emails.direction, "out"),
      eq(emails.status, "sent"),
      // Older rows may keep the address as it was typed, in any case.
      inArray(sql`lower(${emails.toAddress})`, report.recipients),
    ),
    orderBy: [desc(emails.sentAt), desc(emails.createdAt)],
  });
}

export const BOUNCED_REASON = "Cancelado: e-mail voltou";

/**
 * Marks the e-mail a bounce matched as never delivered and stops writing to that dead address:
 * the lead's queued AI e-mails are cancelled and no follow-up is due any more. A report read
 * twice (overlapping polls) keeps the first time.
 */
async function markBounced(db: Db, email: Email, now: Date): Promise<boolean> {
  const marked = await db
    .update(emails)
    .set({ bouncedAt: now })
    .where(and(eq(emails.id, email.id), isNull(emails.bouncedAt)))
    .returning({ id: emails.id });
  if (marked.length === 0) return false;
  await cancelQueuedAi(db, email.leadId, BOUNCED_REASON);
  await db.update(leads).set({ followUpOn: null }).where(eq(leads.id, email.leadId));
  return true;
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
      .set({ status: "cancelled", error: "Cancelado: o lead pediu para não receber" })
      .where(and(eq(emails.leadId, leadId), inArray(emails.status, ["queued", "draft"]))),
  ]);
}

/** Cancels the AI's queued e-mails (follow-up, pending reply) for one lead. */
export async function cancelQueuedAi(db: Db, leadId: string, reason: string) {
  await db
    .update(emails)
    .set({ status: "cancelled", error: reason })
    .where(and(eq(emails.leadId, leadId), eq(emails.status, "queued"), eq(emails.author, "ai")));
}

/** How far a received Date header may be ahead of our clock (a slightly fast sender clock). */
const MAX_DATE_AHEAD_MS = 10 * 60_000;
/** How old it may be: a poll can run late after downtime, but not by more than this. */
const MAX_DATE_BEHIND_MS = 30 * 24 * 60 * 60_000;

/**
 * When to show a received e-mail. The Date header is whatever the sender wrote: a year-2099
 * date would sit on top of "Atividade de hoje" for ever, and a 1970 one sinks below the
 * thread. Outside a plausible window the time we read it is used instead.
 */
export function receivedAt(date: Date | null, now: Date): Date {
  if (!date) return now;
  const offset = date.getTime() - now.getTime();
  return offset > MAX_DATE_AHEAD_MS || offset < -MAX_DATE_BEHIND_MS ? now : date;
}

/**
 * The Message-ID an answer to `message` threads on: its own, or else the newest one it answers.
 * Null only when the message carries none at all.
 */
export function replyTarget(
  message: Pick<IncomingEmail, "messageId" | "inReplyTo" | "references">,
): string | null {
  return message.messageId ?? message.inReplyTo ?? message.references.at(-1) ?? null;
}

/** Stores a reply and decides what happens next. Returns false when it is not ours. */
export async function handleInbound(
  deps: { db: Db; mailer: Mailer; analyzer: LeadAnalyzer },
  message: IncomingEmail,
  now = new Date(),
): Promise<boolean> {
  const { db, mailer, analyzer } = deps;
  if (!message.from || message.from.toLowerCase() === mailer.address) return false;
  const bounced = await findBouncedEmail(db, message);
  // A bounce is the server's word about our e-mail, not a message from the lead: it marks the
  // e-mail as never delivered and is not stored as a reply.
  if (bounced) return markBounced(db, bounced, now);
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
      automatic: message.automatic,
      sentAt: receivedAt(message.date, now),
    })
    .onConflictDoNothing()
    .returning({ id: emails.id });
  if (stored.length === 0) return false;
  // Out-of-office and other machine mail is kept in the thread but changes nothing.
  if (message.automatic) return true;

  const optOut = isUnsubscribeRequest(message.text, message.subject);
  // A match on the From header alone can be forged, so only a reply in the thread opts out.
  if (optOut && inThread) {
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
      // A lost deal answering is back in conversation: its loss no longer holds.
      ...(lead.status === "closed" ? {} : outcomeReset("replied")),
      followUpOn: null,
      lastEmailAt: now,
    })
    .where(eq(leads.id, lead.id));

  // Unverified sender: a person checks it before anything else happens.
  if (!inThread) {
    await handOff(
      db,
      lead.id,
      optOut
        ? "Pediu para sair, mas a mensagem não tem vínculo com o e-mail enviado; confira o remetente"
        : "Resposta sem vínculo com o e-mail enviado; confira o remetente",
    );
    return true;
  }

  if (message.truncated) {
    await handOff(db, lead.id, "Mensagem grande demais, lida só em parte; confira no seu e-mail");
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
  // The user's reply in progress wins: the AI neither answers nor drafts over it.
  if (await hasUserDraft(db, lead.id)) {
    await handOff(db, lead.id, USER_DRAFT_REASON);
    return true;
  }

  const history = await thread(db, lead.id);
  const aiReplies = history.filter(
    (item) =>
      item.direction === "out" &&
      item.author === "ai" &&
      (item.inReplyTo !== null || item.conversationReply),
  ).length;
  if (aiReplies >= MAX_AI_REPLIES) {
    await handOff(db, lead.id, `A IA já respondeu ${MAX_AI_REPLIES} vezes`);
    return true;
  }
  const aiAttempts = await db.$count(
    emails,
    and(
      eq(emails.leadId, lead.id),
      eq(emails.direction, "out"),
      eq(emails.author, "ai"),
      or(isNotNull(emails.inReplyTo), eq(emails.conversationReply, true)),
      ne(emails.status, "draft"),
    ),
  );
  if (aiAttempts >= MAX_AI_REPLY_ATTEMPTS) {
    await handOff(db, lead.id, "A conversa está rápida demais para a IA; responda você");
    return true;
  }

  const conversation: ThreadMessage[] = history.map((item) => ({
    from: item.direction === "out" ? "eu" : "empresa",
    text: item.body,
  }));
  const inReplyTo = replyTarget(message);
  const base = {
    leadId: lead.id,
    direction: "out" as const,
    author: "ai" as const,
    fromAddress: mailer.address,
    toAddress: lead.email ?? message.from,
    subject: replySubject(message.subject),
    inReplyTo,
  };
  // Kept without signature: it is added when the person sends it. Skipped when the user
  // started a reply of their own in the meantime.
  const leaveDraft = (text: string) => insertDraftUnlessUserHasOne(db, { ...base, body: text });
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
        return true;
      }
      if (await hasUserDraft(db, lead.id)) {
        // The user started an answer while the AI was writing; theirs goes instead.
        await handOff(db, lead.id, USER_DRAFT_REASON);
        return true;
      }
      await db.insert(emails).values({
        ...base,
        id: crypto.randomUUID(),
        status: "queued",
        // Nothing to thread on: still an answer, never cold outreach held by the window.
        conversationReply: inReplyTo === null,
        body: composeBody(decision.reply, settings, false),
        sendAfter: new Date(now.getTime() + REPLY_DELAY_MINUTES * 60_000),
      });
      return true;
    }
    if (decision.action === "close") {
      if (isOptOutReason(decision.reason)) {
        await unsubscribe(db, lead.id, now);
        return true;
      }
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
          .set({ status: "cancelled", error: CLOSED_REASON })
          .where(and(eq(emails.leadId, lead.id), inArray(emails.status, ["queued", "draft"]))),
      ]);
      return true;
    }
    await handOff(db, lead.id, decision.reason);
    if (decision.draft) await leaveDraft(cleanText(decision.draft));
  } catch (error) {
    console.error("email reply failed", lead.id, error);
    if (error instanceof ForbiddenPhrasesError) {
      await recordAiCost(db, calls(error.usage), error.usage.cost);
      await handOff(db, lead.id, "Resposta da IA para revisar: frases proibidas");
      await leaveDraft(cleanText(error.text));
      return true;
    }
    await handOff(db, lead.id, "A IA não conseguiu responder");
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
  // Paused: no follow-up is drafted (each one is a paid model call) until someone resumes.
  if ((await loadDispatchControl(db)).pausedAt) return 0;
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
        // An e-mail that came back means a dead address: nothing more goes to it.
        sql`not exists (select 1 from emails b where b.lead_id = ${leads.id} and b.bounced_at is not null)`,
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
        continue;
      }
      await db.update(leads).set({ emailFollowUps: 0 }).where(eq(leads.id, lead.id));
    }
  }
  return queued;
}

/**
 * Whether the lead in `leadId` (a column) had a first e-mail taken out by "Cancelar disparo"
 * for today's run: the automatic dispatch leaves it alone until tomorrow, or cancelling would
 * be undone (and paid for again) on the next hourly run.
 */
function cancelledToday(leadId: SQLWrapper, now: Date) {
  const since = Math.floor(brazilInstant(localDay(now), "00:00").getTime() / 1000);
  return sql`exists (select 1 from emails c where c.lead_id = ${leadId} and c.status = 'cancelled'
    and c.error = ${DISPATCH_CANCELLED_REASON} and c.send_after >= ${since})`;
}

/** Whether today's cold run was cancelled or paused since it started. */
async function dispatchStopped(db: Db, now: Date): Promise<boolean> {
  const row = await db.query.settings.findFirst({
    columns: { dispatchPausedAt: true, dispatchCancelledOn: true },
  });
  if (!row) return false;
  return row.dispatchPausedAt !== null || row.dispatchCancelledOn === localDay(now);
}

/** With automatic dispatch on, new leads with an e-mail are drafted and queued. */
export async function autoDispatch(
  deps: { db: Db; analyzer: LeadAnalyzer; fromAddress: string; limit: number },
  now = new Date(),
): Promise<number> {
  const { db } = deps;
  const row = await db.query.settings.findFirst();
  if (!row?.autoDispatch) return 0;
  // Paused: nothing new is drafted (each draft is a paid model call) until someone resumes.
  if (row.dispatchPausedAt) return 0;
  // "Cancelar disparo" stops the rest of today's run; tomorrow's goes ahead.
  if (row.dispatchCancelledOn === localDay(now)) return 0;
  const remaining = coldDailyLimit(deps.limit) - (await requestsToday(db, EMAIL_PROVIDER, now));
  const queuedCount = await db.$count(emails, eq(emails.status, "queued"));
  // Capped per run: each candidate costs a model call, and a high daily limit would otherwise
  // draft hundreds of e-mails in one cron run. The next hourly run picks up the rest.
  const room = Math.min(remaining - queuedCount, AUTO_DISPATCH_PER_RUN);
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
        sql`not ${wasContacted(leads.id)}`,
        sql`not ${cancelledToday(leads.id, now)}`,
      ),
    )
    // Leads that already have a draft go last: a draft held for review must not take the
    // slots of fresh leads on every tick, or nothing would ever be sent.
    .orderBy(
      sql`exists (select 1 from emails e where e.lead_id = ${leads.id} and e.direction = 'out')`,
      desc(leads.score),
      asc(leads.createdAt),
      asc(leads.id),
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
  // Drafting takes a while: a cancel (or pause) in the meantime keeps them as drafts.
  if (await dispatchStopped(db, now)) return 0;
  return queueDrafts(
    db,
    ready.map((draft) => draft.id),
    now,
  );
}

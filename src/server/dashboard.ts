import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import {
  and,
  countDistinct,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { emails, leads, searches, type EmailStatus } from "@/db/schema";
import { localDay } from "@/lib/format";
import { LATE_REPLY_HOURS } from "@/lib/overview";
import { mailConfigured } from "@/lib/mail";
import { MANUAL_SEARCH_ID } from "@/lib/searches";
import { autopilotInputSchema } from "@/lib/schemas";
import { ALREADY_RAN_MESSAGE, autopilotDeps, runAutopilot } from "./autopilot";
import { cancellableFirstEmails } from "./dispatch-control";
import { recordJobRun } from "./job-runs";
import { EMAIL_PROVIDER, mailDailyLimit, wasContacted } from "./mail-flow";
import {
  loadAutopilot,
  loadConfig,
  loadDispatchControl,
  storeAutopilot,
  writeAutopilot,
} from "./settings-store";
import { GOOGLE_PLACES, placesDailyLimit, requestsToday, usageThisMonth } from "./usage";

const count = sql<number>`count(*)`.mapWith(Number);

/** Conversations listed under "Precisam de você"; `stats.interested` has the full count. */
const ATTENTION_LIST_LIMIT = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far back "Quando os leads respondem" looks. */
const REPLY_HOURS_DAYS = 30;

/** How far back "Voltaram (bounce)" looks. */
const BOUNCE_DAYS = 30;

/** Start of the given Brazil day as an instant (Brazil has no daylight saving time). */
function dayStart(day: string) {
  return new Date(`${day}T00:00:00-03:00`);
}

/** How a first e-mail of today ended: sent, refused by the server, or sent and bounced back. */
function sendOutcome(status: EmailStatus, bouncedAt: Date | null): "sent" | "failed" | "bounced" {
  if (bouncedAt) return "bounced";
  if (status === "failed") return "failed";
  return "sent";
}

/**
 * When the lead last wrote to us: its latest real (non-automatic) e-mail, or the last e-mail
 * of the thread when it never wrote by e-mail (a WhatsApp lead marked as replied).
 */
export const lastInboundAt = sql`coalesce((select max(i.sent_at) from emails i where i.lead_id = ${leads.id} and i.direction = 'in' and i.automatic = 0), ${leads.lastEmailAt})`;

/** Something went out to the lead after its last message: it is no longer waiting on us. */
export const answeredSinceInbound = sql`exists (select 1 from emails o where o.lead_id = ${leads.id} and o.direction = 'out' and o.status = 'sent' and o.sent_at > ${lastInboundAt})`;

/**
 * Late (the red badge and the "esfriando" alert, one definition): the lead's last message is
 * theirs, older than LATE_REPLY_HOURS, and nothing was sent after it.
 */
export function lateReply(now: Date) {
  const cutoff = Math.floor(now.getTime() / 1000) - LATE_REPLY_HOURS * 3600;
  return sql`(${lastInboundAt} < ${cutoff} and not ${answeredSinceInbound})`;
}

const needsYou = and(
  eq(leads.status, "replied"),
  eq(leads.aiMode, false),
  isNull(leads.unsubscribedAt),
);

/** Everything the overview shows, in one round trip. */
export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const now = new Date();
  const today = localDay(now);
  const since = dayStart(today);

  const [
    attention,
    interested,
    totals,
    contacted,
    replied,
    readyToSend,
    queue,
    todaySearches,
    todayEmails,
    config,
    month,
    sentToday,
    googleToday,
    recentSends,
    nextQueued,
    failedToday,
    cooling,
    replyHours,
    dispatch,
    bounces,
    cancellable,
  ] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        city: leads.city,
        niche: searches.niche,
        handoffReason: leads.handoffReason,
        lastEmailAt: leads.lastEmailAt,
        lastInboundAt: sql<number | null>`${lastInboundAt}`.mapWith(
          (value: number) => new Date(value * 1000),
        ),
        late: sql<number>`case when ${lateReply(now)} then 1 else 0 end`.mapWith(
          (value: number) => value === 1,
        ),
      })
      .from(leads)
      .leftJoin(searches, eq(searches.id, leads.searchId))
      .where(needsYou)
      .orderBy(desc(leads.lastEmailAt))
      .limit(ATTENTION_LIST_LIMIT),
    // Counted on its own: the list above is capped, the number must not be.
    db.select({ value: count }).from(leads).where(needsYou),
    db
      .select({
        all: count,
        aiTalking:
          sql<number>`coalesce(sum(case when ${leads.status} = 'replied' and ${leads.aiMode} = 1 then 1 else 0 end), 0)`.mapWith(
            Number,
          ),
        closed:
          sql<number>`coalesce(sum(case when ${leads.status} = 'closed' then 1 else 0 end), 0)`.mapWith(
            Number,
          ),
        unsubscribed:
          sql<number>`coalesce(sum(case when ${leads.unsubscribedAt} is not null then 1 else 0 end), 0)`.mapWith(
            Number,
          ),
        withEmail:
          sql<number>`coalesce(sum(case when ${leads.email} is not null then 1 else 0 end), 0)`.mapWith(
            Number,
          ),
      })
      .from(leads),
    db
      .select({ value: countDistinct(emails.leadId) })
      .from(emails)
      .where(and(eq(emails.direction, "out"), eq(emails.status, "sent"))),
    // Only leads we e-mailed, so "x% dos contatados" never passes 100% (a lead contacted on
    // WhatsApp who writes in by e-mail is not one of the contacted).
    db
      .select({ value: countDistinct(emails.leadId) })
      .from(emails)
      .where(
        and(
          eq(emails.direction, "in"),
          // Out-of-office and other machine mail is not a reply.
          eq(emails.automatic, false),
          sql`exists (select 1 from emails o where o.lead_id = ${emails.leadId} and o.direction = 'out' and o.status = 'sent')`,
        ),
      ),
    db
      .select({ value: count })
      .from(leads)
      .where(
        and(
          eq(leads.status, "new"),
          eq(leads.analysisStatus, "done"),
          isNotNull(leads.email),
          isNull(leads.unsubscribedAt),
          sql`not ${wasContacted(leads.id)}`,
        ),
      ),
    db
      .select({ value: count, next: sql<number | null>`min(${emails.sendAfter})` })
      .from(emails)
      .where(eq(emails.status, "queued")),
    db
      .select({
        id: searches.id,
        niche: searches.niche,
        city: searches.city,
        status: searches.status,
        origin: searches.origin,
        foundCount: searches.foundCount,
        createdAt: searches.createdAt,
      })
      .from(searches)
      .where(and(gte(searches.createdAt, since), ne(searches.id, MANUAL_SEARCH_ID)))
      .orderBy(desc(searches.createdAt)),
    db
      .select({
        id: emails.id,
        leadId: emails.leadId,
        name: leads.name,
        direction: emails.direction,
        author: emails.author,
        inReplyTo: emails.inReplyTo,
        at: emails.sentAt,
      })
      .from(emails)
      .innerJoin(leads, eq(leads.id, emails.leadId))
      .where(and(inArray(emails.status, ["sent", "received"]), gte(emails.sentAt, since)))
      .orderBy(desc(emails.sentAt))
      .limit(30),
    loadConfig(db),
    usageThisMonth(db, now),
    requestsToday(db, EMAIL_PROVIDER, now),
    requestsToday(db, GOOGLE_PLACES, now),
    // Today's first e-mails and their outcome, for "Disparo de hoje". A failed send keeps the
    // time of its last attempt (`sendAfter`, set when the send broke), since it has no `sentAt`.
    db
      .select({
        id: emails.id,
        leadId: emails.leadId,
        name: leads.name,
        niche: searches.niche,
        to: emails.toAddress,
        status: emails.status,
        bouncedAt: emails.bouncedAt,
        at: sql<number>`coalesce(${emails.sentAt}, ${emails.sendAfter})`.mapWith(
          (value: number) => new Date(value * 1000),
        ),
      })
      .from(emails)
      .innerJoin(leads, eq(leads.id, emails.leadId))
      .leftJoin(searches, eq(searches.id, leads.searchId))
      .where(
        and(
          eq(emails.direction, "out"),
          isNull(emails.inReplyTo),
          inArray(emails.status, ["sent", "failed"]),
          gte(
            sql`coalesce(${emails.sentAt}, ${emails.sendAfter})`,
            Math.floor(since.getTime() / 1000),
          ),
        ),
      )
      .orderBy(desc(sql`coalesce(${emails.sentAt}, ${emails.sendAfter})`))
      .limit(6),
    db
      .select({
        id: emails.id,
        leadId: emails.leadId,
        name: leads.name,
        niche: searches.niche,
        to: emails.toAddress,
        at: emails.sendAfter,
      })
      .from(emails)
      .innerJoin(leads, eq(leads.id, emails.leadId))
      .leftJoin(searches, eq(searches.id, leads.searchId))
      .where(eq(emails.status, "queued"))
      .orderBy(emails.sendAfter)
      .limit(1),
    db
      .select({ value: count })
      .from(emails)
      .where(
        and(eq(emails.direction, "out"), eq(emails.status, "failed"), gte(emails.sendAfter, since)),
      ),
    // Interested leads late for an answer: the same rule as the red badge (see lateReply).
    db
      .select({ value: count })
      .from(leads)
      .where(and(needsYou, lateReply(now))),
    // Replies of the last 30 days by Brazil hour (UTC-3, no daylight saving time).
    db
      .select({
        hour: sql<number>`cast(strftime('%H', ${emails.sentAt} - 10800, 'unixepoch') as integer)`.mapWith(
          Number,
        ),
        value: count,
      })
      .from(emails)
      .where(
        and(
          eq(emails.direction, "in"),
          eq(emails.status, "received"),
          eq(emails.automatic, false),
          gte(emails.sentAt, new Date(now.getTime() - REPLY_HOURS_DAYS * DAY_MS)),
        ),
      )
      .groupBy(sql`1`),
    loadDispatchControl(db),
    // Sends of the last 30 days and how many of them came back, plus today's bounces.
    db
      .select({
        sent30d: count,
        bounced30d:
          sql<number>`coalesce(sum(case when ${emails.bouncedAt} is not null then 1 else 0 end), 0)`.mapWith(
            Number,
          ),
        bouncedToday:
          sql<number>`coalesce(sum(case when ${emails.bouncedAt} >= ${Math.floor(since.getTime() / 1000)} then 1 else 0 end), 0)`.mapWith(
            Number,
          ),
      })
      .from(emails)
      .where(
        and(
          eq(emails.direction, "out"),
          eq(emails.status, "sent"),
          gte(emails.sentAt, new Date(now.getTime() - BOUNCE_DAYS * DAY_MS)),
        ),
      ),
    db.select({ value: count }).from(emails).where(cancellableFirstEmails(now)),
  ]);

  const total = totals[0];
  const { autopilot, settings } = config;
  return {
    today,
    // When this was read: "waiting for 3 h" is measured from here, the same on server and client.
    now,
    attention,
    stats: {
      leads: total?.all ?? 0,
      withEmail: total?.withEmail ?? 0,
      contacted: contacted[0]?.value ?? 0,
      replied: replied[0]?.value ?? 0,
      aiTalking: total?.aiTalking ?? 0,
      interested: interested[0]?.value ?? 0,
      closed: total?.closed ?? 0,
      unsubscribed: total?.unsubscribed ?? 0,
      readyToSend: readyToSend[0]?.value ?? 0,
      cooling: cooling[0]?.value ?? 0,
    },
    replyHours,
    mail: {
      configured: mailConfigured(env),
      address: (env.MAIL_ADDRESS ?? "").toLowerCase(),
      sentToday,
      limit: mailDailyLimit(env.MAIL_DAILY_LIMIT),
      queued: queue[0]?.value ?? 0,
      nextSendAt: queue[0]?.next ? new Date(queue[0].next * 1000) : null,
      failedToday: failedToday[0]?.value ?? 0,
      recentSends: recentSends.map(({ bouncedAt, status, ...send }) => ({
        ...send,
        status: sendOutcome(status, bouncedAt),
      })),
      nextQueued: nextQueued[0] ?? null,
      aiAutoReply: config.aiAutoReply,
      autoDispatch: config.autoDispatch,
      paused: dispatch.pausedAt !== null,
      windowStart: dispatch.start,
      windowEnd: dispatch.end,
      // First e-mails "Cancelar disparo" would take out of the queue.
      cancellable: cancellable[0]?.value ?? 0,
      bouncedToday: bounces[0]?.bouncedToday ?? 0,
      bounced30d: bounces[0]?.bounced30d ?? 0,
      sent30d: bounces[0]?.sent30d ?? 0,
    },
    activity: { searches: todaySearches, emails: todayEmails },
    autopilot: {
      enabled: autopilot.enabled,
      hour: autopilot.hour,
      targets: autopilot.targets.map(({ niche, city }) => ({ niche, city })),
      lastRunOn: autopilot.lastRunOn,
    },
    setup: {
      keys: Boolean(env.GOOGLE_PLACES_API_KEY && env.DEEPSEEK_API_KEY),
      offer: settings.offer.length > 0,
    },
    costs: {
      month,
      googleToday,
      googleLimit: placesDailyLimit(env.PLACES_DAILY_REQUEST_LIMIT),
    },
  };
});

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

/** How many conversations wait for the user, for the sidebar badge. */
export const getAttentionCount = createServerFn({ method: "GET" }).handler(async () => {
  const rows = await getDb().select({ value: count }).from(leads).where(needsYou);
  return rows[0]?.value ?? 0;
});

export const getAutopilot = createServerFn({ method: "GET" }).handler(async () => {
  const { autopilot, aiAutoReply, autoDispatch } = await loadConfig(getDb());
  return {
    enabled: autopilot.enabled,
    hour: autopilot.hour,
    results: autopilot.results,
    targets: autopilot.targets.map(({ niche, city }) => ({ niche, city })),
    aiAutoReply,
    autoDispatch,
  };
});

export const saveAutopilot = createServerFn({ method: "POST" })
  .validator(autopilotInputSchema)
  .handler(async ({ data }) => {
    await storeAutopilot(getDb(), data);
    return { ok: true as const };
  });

export const setAutomation = createServerFn({ method: "POST" })
  .validator(
    z.object({
      autopilot: z.boolean().optional(),
      aiAutoReply: z.boolean().optional(),
      autoDispatch: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await writeAutopilot(getDb(), {
      ...(data.autopilot !== undefined ? { autopilotEnabled: data.autopilot } : {}),
      ...(data.aiAutoReply !== undefined ? { aiAutoReply: data.aiAutoReply } : {}),
      ...(data.autoDispatch !== undefined ? { autoDispatch: data.autoDispatch } : {}),
    });
    return { ok: true as const };
  });

/** Runs today's searches right away, ignoring the hour; refuses when today already ran. */
export const runAutopilotNow = createServerFn({ method: "POST" }).handler(async () => {
  const db = getDb();
  const autopilot = await loadAutopilot(db);
  if (autopilot.targets.length === 0) {
    throw new Error("Cadastre ao menos um nicho e cidade na busca diária, em Configurações.");
  }
  const now = new Date();
  let result;
  try {
    result = await runAutopilot(autopilotDeps(env), now, { force: true });
  } catch (error) {
    await recordJobRun(db, "autopilot", { status: "failed", error }, now);
    throw error;
  }
  if (result.alreadyRan) throw new Error(ALREADY_RAN_MESSAGE);
  await recordJobRun(
    db,
    "autopilot",
    result.failure === undefined ? { status: "ok" } : { status: "failed", error: result.failure },
    now,
  );
  return { searches: result.searches };
});

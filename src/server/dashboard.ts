import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { and, countDistinct, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { emails, leads, searches } from "@/db/schema";
import { localDay } from "@/lib/format";
import { mailConfigured } from "@/lib/mail";
import { autopilotInputSchema } from "@/lib/schemas";
import { ALREADY_RAN_MESSAGE, autopilotDeps, runAutopilot } from "./autopilot";
import { recordJobRun } from "./job-runs";
import { EMAIL_PROVIDER, mailDailyLimit } from "./mail-flow";
import { loadAutopilot, loadConfig, storeAutopilot, writeAutopilot } from "./settings-store";
import { GOOGLE_PLACES, placesDailyLimit, requestsToday, usageThisMonth } from "./usage";

const count = sql<number>`count(*)`.mapWith(Number);

/** Start of the given Brazil day as an instant (Brazil has no daylight saving time). */
function dayStart(day: string) {
  return new Date(`${day}T00:00:00-03:00`);
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
  ] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        handoffReason: leads.handoffReason,
        lastEmailAt: leads.lastEmailAt,
      })
      .from(leads)
      .where(needsYou)
      .orderBy(desc(leads.lastEmailAt))
      .limit(20),
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
    db
      .select({ value: countDistinct(emails.leadId) })
      .from(emails)
      .where(eq(emails.direction, "in")),
    db
      .select({ value: count })
      .from(leads)
      .where(
        and(
          eq(leads.status, "new"),
          eq(leads.analysisStatus, "done"),
          isNotNull(leads.email),
          isNull(leads.unsubscribedAt),
          sql`not exists (select 1 from emails e where e.lead_id = ${leads.id} and e.direction = 'out' and e.status <> 'draft')`,
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
      .where(gte(searches.createdAt, since))
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
  ]);

  const total = totals[0];
  const { autopilot, settings } = config;
  return {
    today,
    attention,
    stats: {
      leads: total?.all ?? 0,
      withEmail: total?.withEmail ?? 0,
      contacted: contacted[0]?.value ?? 0,
      replied: replied[0]?.value ?? 0,
      aiTalking: total?.aiTalking ?? 0,
      interested: attention.length,
      closed: total?.closed ?? 0,
      unsubscribed: total?.unsubscribed ?? 0,
      readyToSend: readyToSend[0]?.value ?? 0,
    },
    mail: {
      configured: mailConfigured(env),
      address: (env.MAIL_ADDRESS ?? "").toLowerCase(),
      sentToday,
      limit: mailDailyLimit(env.MAIL_DAILY_LIMIT),
      queued: queue[0]?.value ?? 0,
      nextSendAt: queue[0]?.next ? new Date(queue[0].next * 1000) : null,
      aiAutoReply: config.aiAutoReply,
      autoDispatch: config.autoDispatch,
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
    throw new Error("Cadastre ao menos um nicho e cidade no piloto automático.");
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

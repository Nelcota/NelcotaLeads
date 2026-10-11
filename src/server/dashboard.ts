import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { analyses, leads, searches } from "@/db/schema";
import { getAnalyzer } from "@/lib/ai";
import { localDay } from "@/lib/format";
import { autopilotInputSchema } from "@/lib/schemas";
import { autopilotDeps, runAutopilot } from "./autopilot";
import { draftFollowUps } from "./follow-ups";
import { latestAnalysis } from "./leads-query";
import { hasOffer, NO_OFFER_MESSAGE, writeMessageForLead } from "./process-lead";
import { loadAutopilot, loadSettings, storeAutopilot, writeAutopilot } from "./settings-store";
import { GOOGLE_PLACES, placesDailyLimit, requestsToday, usageThisMonth } from "./usage";

const count = sql<number>`count(*)`.mapWith(Number);
// Re-analyses add rows to `analyses`; the dashboard counts companies, not calls.
const leadCount = sql<number>`count(distinct ${analyses.leadId})`.mapWith(Number);

/** Start of the given Brazil day as an instant (Brazil has no daylight saving time). */
function dayStart(day: string) {
  return new Date(`${day}T00:00:00-03:00`);
}

/** Everything the dashboard shows, in one round trip. */
export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const now = new Date();
  const today = localDay(now);
  const since = dayStart(today);

  const [
    ready,
    followUps,
    statusCounts,
    pending,
    withoutMessage,
    aiDiscarded,
    todaySearches,
    analyzedToday,
    messagesToday,
    discardedToday,
    autopilot,
    settings,
    month,
    googleToday,
  ] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        phoneE164: leads.phoneE164,
        website: leads.website,
        rating: leads.rating,
        reviewCount: leads.reviewCount,
        score: leads.score,
        summary: analyses.summary,
        signals: analyses.signals,
        analysisId: analyses.id,
        firstMessage: analyses.firstMessage,
      })
      .from(leads)
      .innerJoin(analyses, and(eq(analyses.leadId, leads.id), latestAnalysis))
      .where(
        and(
          eq(leads.status, "new"),
          eq(leads.analysisStatus, "done"),
          isNotNull(analyses.firstMessage),
        ),
      )
      .orderBy(desc(leads.score), asc(leads.name))
      .limit(100),
    db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        phoneE164: leads.phoneE164,
        status: leads.status,
        contactedAt: leads.contactedAt,
        followUpOn: leads.followUpOn,
        followUpMessage: leads.followUpMessage,
        followUpMessageFor: leads.followUpMessageFor,
      })
      .from(leads)
      .where(and(inArray(leads.status, ["contacted", "replied"]), lte(leads.followUpOn, today)))
      .orderBy(asc(leads.followUpOn), desc(leads.score))
      .limit(100),
    db.select({ status: leads.status, count }).from(leads).groupBy(leads.status),
    db.select({ count }).from(leads).where(eq(leads.analysisStatus, "pending")),
    db
      .select({ count })
      .from(leads)
      .innerJoin(analyses, and(eq(analyses.leadId, leads.id), latestAnalysis))
      .where(and(eq(leads.status, "new"), isNull(analyses.firstMessage))),
    db
      .select({ count })
      .from(leads)
      .where(and(eq(leads.status, "discarded"), isNotNull(leads.discardReason))),
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
      .orderBy(asc(searches.createdAt)),
    db.select({ count: leadCount }).from(analyses).where(gte(analyses.createdAt, since)),
    db
      .select({ count: leadCount })
      .from(analyses)
      .where(and(gte(analyses.createdAt, since), isNotNull(analyses.firstMessage))),
    db.select({ count }).from(leads).where(gte(leads.discardedAt, since)),
    loadAutopilot(db),
    loadSettings(db),
    usageThisMonth(db, now),
    requestsToday(db, GOOGLE_PLACES, now),
  ]);

  const byStatus = Object.fromEntries(statusCounts.map((row) => [row.status, row.count]));
  return {
    today,
    ready,
    followUps,
    analyzing: pending[0]?.count ?? 0,
    withoutMessage: withoutMessage[0]?.count ?? 0,
    funnel: {
      ready: ready.length,
      waiting: byStatus.contacted ?? 0,
      talking: byStatus.replied ?? 0,
      closed: byStatus.closed ?? 0,
      aiDiscarded: aiDiscarded[0]?.count ?? 0,
    },
    activity: {
      searches: todaySearches,
      analyzed: analyzedToday[0]?.count ?? 0,
      messages: messagesToday[0]?.count ?? 0,
      discarded: discardedToday[0]?.count ?? 0,
      reminders: followUps.filter(
        (lead) => lead.followUpMessage && lead.followUpMessageFor === lead.followUpOn,
      ).length,
    },
    autopilot: {
      enabled: autopilot.enabled,
      hour: autopilot.hour,
      results: autopilot.results,
      targets: autopilot.targets.map(({ niche, city }) => ({ niche, city })),
      lastRunOn: autopilot.lastRunOn,
    },
    setup: {
      keys: Boolean(env.GOOGLE_PLACES_API_KEY && env.DEEPSEEK_API_KEY),
      offer: settings.offer.length > 0,
      minScore: settings.minScore,
    },
    costs: {
      month: month,
      googleToday,
      googleLimit: placesDailyLimit(env.PLACES_DAILY_REQUEST_LIMIT),
    },
  };
});

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

export const getAutopilot = createServerFn({ method: "GET" }).handler(async () => {
  const autopilot = await loadAutopilot(getDb());
  return {
    enabled: autopilot.enabled,
    hour: autopilot.hour,
    results: autopilot.results,
    targets: autopilot.targets.map(({ niche, city }) => ({ niche, city })),
  };
});

export const saveAutopilot = createServerFn({ method: "POST" })
  .validator(autopilotInputSchema)
  .handler(async ({ data }) => {
    await storeAutopilot(getDb(), data);
    return { ok: true as const };
  });

export const setAutopilotEnabled = createServerFn({ method: "POST" })
  .validator(z.object({ enabled: z.boolean() }))
  .handler(async ({ data }) => {
    await writeAutopilot(getDb(), { autopilotEnabled: data.enabled });
    return { ok: true as const };
  });

/** Runs today's searches right away, ignoring the hour and whether they already ran. */
export const runAutopilotNow = createServerFn({ method: "POST" }).handler(async () => {
  const autopilot = await loadAutopilot(getDb());
  if (autopilot.targets.length === 0) {
    throw new Error("Cadastre ao menos um nicho e cidade no piloto automático.");
  }
  return runAutopilot(autopilotDeps(env), new Date(), { force: true });
});

/** Writes the reminders that are due now instead of waiting for the next hourly tick. */
export const draftFollowUpsNow = createServerFn({ method: "POST" }).handler(async () => ({
  drafted: await draftFollowUps({ db: getDb(), analyzer: getAnalyzer(env) }, localDay(new Date())),
}));

/** Writes the first message for new leads that have none (old analyses or a failed call). */
export const writeMissingMessages = createServerFn({ method: "POST" }).handler(async () => {
  const db = getDb();
  if (!hasOffer(await loadSettings(db))) throw new Error(NO_OFFER_MESSAGE);
  const analyzer = getAnalyzer(env);
  const missing = await db
    .select({ id: leads.id })
    .from(leads)
    .innerJoin(analyses, and(eq(analyses.leadId, leads.id), latestAnalysis))
    .where(and(eq(leads.status, "new"), isNull(analyses.firstMessage)))
    .orderBy(desc(leads.score))
    .limit(10);
  let written = 0;
  for (const lead of missing) {
    try {
      await writeMessageForLead({ db, analyzer }, lead.id);
      written += 1;
    } catch (error) {
      console.error("message generation failed", lead.id, error);
    }
  }
  return { written, failed: missing.length - written };
});

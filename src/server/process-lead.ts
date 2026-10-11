import { and, eq, gte, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { analyses, leads, searches, type Lead } from "@/db/schema";
import type { CallUsage, LeadAnalyzer, LeadContext } from "@/lib/ai";
import type { SiteResult } from "@/lib/scrape";
import { loadSettings } from "./settings-store";
import type { LeadJob } from "./queue";

export type ProcessDeps = {
  db: Db;
  analyzer: LeadAnalyzer;
  fetchSite: (url: string) => Promise<SiteResult>;
};

/** Attempts per message before the lead is marked as failed (keep below the queue max_retries). */
export const MAX_ATTEMPTS = 3;

/**
 * Reads the lead's site, runs the AI analysis and stores the result.
 * Idempotent: an already analyzed lead is skipped unless the job asks to force it.
 * Throws on transient failures so the queue retries the message.
 */
export async function processLead(deps: ProcessDeps, job: LeadJob): Promise<"done" | "skipped"> {
  const { db, analyzer } = deps;
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, job.leadId) });
  if (!lead) return "skipped";
  if (lead.analysisStatus === "done" && !job.force) return "skipped";

  const search = await db.query.searches.findFirst({ where: eq(searches.id, lead.searchId) });
  const settings = await loadSettings(db);
  const site = await readSite(deps, lead, job.force ?? false);

  const context: LeadContext = {
    niche: search?.niche ?? "",
    name: lead.name,
    address: lead.address,
    city: lead.city,
    hasPhone: Boolean(lead.phone),
    website: lead.website,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    siteStatus: site.siteStatus,
    siteData: site.siteData,
    siteText: site.siteTextExcerpt,
  };

  const { analysis, usage } = await analyzer.analyze(settings, context);
  const usages: CallUsage[] = [usage];

  let firstMessage: string | null = null;
  if (analysis.score >= settings.messageScoreThreshold) {
    try {
      const result = await analyzer.writeMessage(settings, context, analysis);
      firstMessage = result.message;
      usages.push(result.usage);
    } catch (error) {
      // A failed message should not throw away a paid analysis; it can be regenerated later.
      console.error("first message generation failed", lead.id, error);
    }
  }

  const [, updated] = await db.batch([
    db.insert(analyses).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      ...analysis,
      firstMessage,
      model: [...new Set(usages.map((u) => u.model))].join(" + "),
      tokensIn: sum(usages, "tokensIn"),
      tokensOut: sum(usages, "tokensOut"),
      costEstimate: sum(usages, "cost"),
    }),
    db
      .update(leads)
      .set({ analysisStatus: "done", analysisError: null, score: analysis.score })
      .where(
        job.force
          ? eq(leads.id, lead.id)
          : and(eq(leads.id, lead.id), ne(leads.analysisStatus, "done")),
      )
      .returning({ id: leads.id }),
  ]);

  if (updated.length > 0 && !job.force) await bumpSearch(db, lead.searchId, "analyzedCount");
  return "done";
}

/** Records a permanent failure for the lead; called once retries are exhausted. */
export async function failLead(db: Db, job: LeadJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const updated = await db
    .update(leads)
    .set({ analysisStatus: "error", analysisError: message.slice(0, 500) })
    .where(and(eq(leads.id, job.leadId), eq(leads.analysisStatus, "pending")))
    .returning({ searchId: leads.searchId });
  const searchId = updated[0]?.searchId;
  if (searchId && !job.force) await bumpSearch(db, searchId, "errorCount");
}

async function readSite(deps: ProcessDeps, lead: Lead, force: boolean) {
  // Reuse a previous read (e.g. on a retry) unless a fresh analysis was requested.
  if (!lead.website || (lead.siteStatus !== "pending" && !force)) {
    return {
      siteStatus: lead.website ? lead.siteStatus : ("none" as const),
      siteData: lead.siteData,
      siteTextExcerpt: lead.siteTextExcerpt,
    };
  }
  const result = await deps.fetchSite(lead.website);
  const site =
    result.status === "ok"
      ? { siteStatus: "ok" as const, siteData: result.data, siteTextExcerpt: result.text }
      : { siteStatus: result.status, siteData: null, siteTextExcerpt: null };
  await deps.db.update(leads).set(site).where(eq(leads.id, lead.id));
  return site;
}

async function bumpSearch(db: Db, searchId: string, counter: "analyzedCount" | "errorCount") {
  const column = searches[counter];
  await db.batch([
    db
      .update(searches)
      .set({ [counter]: sql`${column} + 1` })
      .where(eq(searches.id, searchId)),
    db
      .update(searches)
      .set({ status: "done" })
      .where(
        and(
          eq(searches.id, searchId),
          eq(searches.status, "analyzing"),
          gte(sql`${searches.analyzedCount} + ${searches.errorCount}`, searches.foundCount),
        ),
      ),
  ]);
}

function sum(usages: CallUsage[], key: "tokensIn" | "tokensOut" | "cost") {
  return usages.reduce((total, usage) => total + usage[key], 0);
}

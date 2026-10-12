import { and, desc, eq, gte, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { analyses, apiUsage, leads, searches, type Lead, type Search } from "@/db/schema";
import type { CallUsage, LeadAnalyzer, LeadContext } from "@/lib/ai";
import { localDay } from "@/lib/format";
import { siteDataSchema, type SiteData } from "@/lib/schemas";
import type { SiteResult } from "@/lib/scrape";
import { loadSettings } from "./settings-store";
import type { LeadJob } from "./queue";
import { DEEPSEEK, recordAiCost } from "./usage";

export type ProcessDeps = {
  db: Db;
  analyzer: LeadAnalyzer;
  fetchSite: (url: string) => Promise<SiteResult>;
};

/** Attempts per message before the lead is marked as failed (keep below the queue max_retries). */
export const MAX_ATTEMPTS = 3;

/** A claim older than this is considered abandoned (e.g. the Worker died mid-analysis). */
export const CLAIM_TIMEOUT_MS = 10 * 60_000;

export const LEAD_BUSY_MESSAGE = "O lead já está sendo analisado";

/**
 * Reads the lead's site, runs the AI analysis and stores the result.
 * Idempotent: an already analyzed lead is skipped unless the job asks to force it, and a
 * lead another job is analyzing right now is never analyzed twice (this job is retried).
 * Throws on transient failures so the queue retries the message.
 */
export async function processLead(deps: ProcessDeps, job: LeadJob): Promise<"done" | "skipped"> {
  const { db } = deps;
  const lead = await claimLead(db, job);
  if (!lead) {
    const current = await db.query.leads.findFirst({
      where: eq(leads.id, job.leadId),
      columns: { analysisStatus: true },
    });
    if (!current || (current.analysisStatus === "done" && !job.force)) return "skipped";
    throw new Error(LEAD_BUSY_MESSAGE);
  }
  try {
    await analyzeClaimed(deps, job, lead);
    return "done";
  } catch (error) {
    // Release the claim so the queue's retry can pick the lead up again.
    await db
      .update(leads)
      .set({ analysisStartedAt: null })
      .where(ownedBy(lead))
      .catch((releaseError: unknown) => {
        console.error("could not release the lead claim", lead.id, releaseError);
      });
    throw error;
  }
}

/**
 * Atomically marks the lead as being analyzed. Returns undefined when the lead is missing,
 * already analyzed (unless forced) or claimed by another job.
 */
async function claimLead(db: Db, job: LeadJob, now = new Date()): Promise<Lead | undefined> {
  const free = or(
    isNull(leads.analysisStartedAt),
    lt(leads.analysisStartedAt, new Date(now.getTime() - CLAIM_TIMEOUT_MS)),
  );
  const [lead] = await db
    .update(leads)
    .set({ analysisStartedAt: now })
    .where(
      job.force
        ? and(eq(leads.id, job.leadId), free)
        : and(eq(leads.id, job.leadId), free, ne(leads.analysisStatus, "done")),
    )
    .returning();
  return lead;
}

/** The lead's row, as long as the claim taken by this job is still in place. */
function ownedBy(lead: Lead) {
  return lead.analysisStartedAt
    ? and(eq(leads.id, lead.id), eq(leads.analysisStartedAt, lead.analysisStartedAt))
    : and(eq(leads.id, lead.id), isNull(leads.analysisStartedAt));
}

async function analyzeClaimed(deps: ProcessDeps, job: LeadJob, lead: Lead) {
  const { db, analyzer } = deps;
  const search = await db.query.searches.findFirst({ where: eq(searches.id, lead.searchId) });
  const settings = await loadSettings(db);
  const site = await readSite(deps, lead, job.force ?? false);

  const context = buildContext({ ...lead, ...site }, search);

  const { analysis, usage } = await analyzer.analyze(settings, context);
  const usages: CallUsage[] = [usage];

  // Triage: below the minimum score the AI discards the lead. Outreach e-mails are
  // written when the lead is selected for a send, not here.
  const keep = settings.minScore <= 0 || analysis.score >= settings.minScore;
  const owned = ownedBy(lead);

  // One transaction: the analysis, its cost, the search counters and the lead all land
  // together, so nothing after the AI call can leave the search stuck in "analyzing".
  await db.batch([
    db.insert(analyses).values({
      id: crypto.randomUUID(),
      leadId: lead.id,
      ...analysis,
      model: [...new Set(usages.map((u) => u.model))].join(" + "),
      tokensIn: sum(usages, "tokensIn"),
      tokensOut: sum(usages, "tokensOut"),
      costEstimate: sum(usages, "cost"),
    }),
    aiCostStatement(db, usages.length, sum(usages, "cost")),
    // Forced re-analysis must not inflate the counters. Runs before the lead update, so it
    // only counts when this job is the one completing the lead.
    ...(job.force
      ? []
      : searchCounterStatements(
          db,
          lead.searchId,
          "analyzedCount",
          sql`exists (select 1 from ${leads} where ${and(owned, ne(leads.analysisStatus, "done"))})`,
        )),
    db
      .update(leads)
      .set({
        analysisStatus: "done",
        analysisError: null,
        analysisStartedAt: null,
        score: analysis.score,
        email: lead.email ?? site.siteData?.emails[0]?.toLowerCase() ?? null,
        ...triagePatch(lead, keep, analysis.score, settings.minScore),
      })
      .where(owned),
  ]);
}

/** The same upsert as recordAiCost, as a statement that can join a batch. */
function aiCostStatement(db: Db, calls: number, costUsd: number, now = new Date()) {
  return db
    .insert(apiUsage)
    .values({ day: localDay(now), provider: DEEPSEEK, requests: calls, costUsd })
    .onConflictDoUpdate({
      target: [apiUsage.day, apiUsage.provider],
      set: {
        requests: sql`${apiUsage.requests} + ${calls}`,
        costUsd: sql`${apiUsage.costUsd} + ${costUsd}`,
      },
    });
}

/** Prefix of the reason the AI writes when it discards a lead for its score. */
const SCORE_DISCARD_PREFIX = "Nota ";

/**
 * Only untouched leads are triaged: the AI never discards a lead you already contacted,
 * and a lead it discarded for its score comes back if a new analysis scores it high
 * enough. Leads discarded for any other reason (unsubscribed, closed) stay discarded.
 */
function triagePatch(
  lead: Pick<Lead, "status" | "discardReason" | "unsubscribedAt">,
  keep: boolean,
  score: number,
  minScore: number,
): Partial<Lead> {
  if (!keep && lead.status === "new") {
    return {
      status: "discarded",
      discardReason: `${SCORE_DISCARD_PREFIX}${score}, abaixo do mínimo de ${minScore}`,
      discardedAt: new Date(),
    };
  }
  if (
    keep &&
    lead.status === "discarded" &&
    !lead.unsubscribedAt &&
    lead.discardReason?.startsWith(SCORE_DISCARD_PREFIX)
  ) {
    return { status: "new", discardReason: null, discardedAt: null };
  }
  return {};
}

/** Writes (or rewrites) the first message for an analyzed lead, regardless of its score. */
export async function writeMessageForLead(
  deps: Pick<ProcessDeps, "db" | "analyzer">,
  leadId: string,
): Promise<string> {
  const { db, analyzer } = deps;
  const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
  if (!lead) throw new Error("Lead não encontrado");
  const analysis = await db.query.analyses.findFirst({
    where: eq(analyses.leadId, leadId),
    orderBy: [desc(analyses.createdAt), desc(analyses.id)],
  });
  if (!analysis) throw new Error("O lead ainda não foi analisado");
  const search = await db.query.searches.findFirst({ where: eq(searches.id, lead.searchId) });
  const settings = await loadSettings(db);
  if (!hasOffer(settings)) throw new Error(NO_OFFER_MESSAGE);

  const { message, usage } = await analyzer.writeMessage(
    settings,
    buildContext(lead, search),
    analysis,
  );
  const models = new Set([...analysis.model.split(" + "), usage.model]);
  await db
    .update(analyses)
    .set({
      firstMessage: message,
      model: [...models].join(" + "),
      tokensIn: analysis.tokensIn + usage.tokensIn,
      tokensOut: analysis.tokensOut + usage.tokensOut,
      costEstimate: analysis.costEstimate + usage.cost,
    })
    .where(eq(analyses.id, analysis.id));
  await recordAiCost(db, 1, usage.cost);
  return message;
}

export const NO_OFFER_MESSAGE =
  "Descreva o que você vende nas Configurações para a IA escrever as mensagens.";

export function hasOffer(settings: { offer: string }) {
  return settings.offer.trim().length > 0;
}

export function buildContext(lead: Lead, search: Search | undefined): LeadContext {
  return {
    niche: search?.niche ?? "",
    name: lead.name,
    address: lead.address,
    city: lead.city,
    hasPhone: Boolean(lead.phone),
    website: lead.website,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    siteStatus: lead.siteStatus,
    siteData: lead.siteData,
    siteText: lead.siteTextExcerpt,
  };
}

/** Records a permanent failure for the lead; called once retries are exhausted. */
export async function failLead(db: Db, job: LeadJob, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const pending = and(eq(leads.id, job.leadId), eq(leads.analysisStatus, "pending"));
  const lead = await db.query.leads.findFirst({ where: pending, columns: { searchId: true } });
  if (!lead) return;
  const markFailed = db
    .update(leads)
    .set({ analysisStatus: "error", analysisError: message.slice(0, 500), analysisStartedAt: null })
    .where(pending);
  if (job.force) {
    await markFailed;
    return;
  }
  // Counted before the lead update, so a duplicate delivery counts nothing.
  const [bump, complete] = searchCounterStatements(
    db,
    lead.searchId,
    "errorCount",
    sql`exists (select 1 from ${leads} where ${pending})`,
  );
  await db.batch([bump, complete, markFailed]);
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
      ? {
          siteStatus: "ok" as const,
          // Scraped from the open web: only stored when it has the expected shape.
          siteData: parseSiteData(result.data),
          siteTextExcerpt: result.text,
        }
      : { siteStatus: result.status, siteData: null, siteTextExcerpt: null };
  await deps.db.update(leads).set(site).where(eq(leads.id, lead.id));
  return site;
}

function parseSiteData(data: unknown): SiteData | null {
  const parsed = siteDataSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/**
 * Bumps a search counter (only when `when` holds) and completes the search once every
 * lead is analyzed or failed. Meant to run in the same batch that changes the lead.
 */
function searchCounterStatements(
  db: Db,
  searchId: string,
  counter: "analyzedCount" | "errorCount",
  when: SQL,
) {
  const column = searches[counter];
  return [
    db
      .update(searches)
      .set({ [counter]: sql`${column} + 1` })
      .where(and(eq(searches.id, searchId), when)),
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
  ] as const;
}

function sum(usages: CallUsage[], key: "tokensIn" | "tokensOut" | "cost") {
  return usages.reduce((total, usage) => total + usage[key], 0);
}

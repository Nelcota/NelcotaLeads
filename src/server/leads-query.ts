import { and, asc, desc, eq, gte, isNull, like, lte, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db/client";
import { analyses, leads } from "@/db/schema";
import type { LeadFilters } from "@/lib/schemas";

export const LIST_LIMIT = 1000;

const SORT_COLUMNS = {
  score: leads.score,
  name: leads.name,
  rating: leads.rating,
  reviewCount: leads.reviewCount,
  createdAt: leads.createdAt,
} as const;

// Latest analysis per lead (re-analysis keeps history).
const latestAnalysis = sql`${analyses.id} = (
  select a2.id from analyses a2 where a2.lead_id = ${leads.id}
  order by a2.created_at desc, a2.rowid desc limit 1
)`;

function whereClause(filters: LeadFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    filters.q ? like(leads.name, `%${filters.q}%`) : undefined,
    filters.searchId ? eq(leads.searchId, filters.searchId) : undefined,
    filters.status ? eq(leads.status, filters.status) : undefined,
    filters.minScore !== undefined ? gte(leads.score, filters.minScore) : undefined,
    filters.maxScore !== undefined ? lte(leads.score, filters.maxScore) : undefined,
    filters.noWebsite ? isNull(leads.website) : undefined,
  ];
  return and(...conditions);
}

function orderBy(filters: LeadFilters) {
  const column = SORT_COLUMNS[filters.sort ?? "score"];
  const direction = (filters.dir ?? "desc") === "desc" ? desc : asc;
  // Unanalyzed leads (null score) go last regardless of direction.
  return [sql`${column} is null`, direction(column), asc(leads.name)];
}

/** Lead rows for the table and the CSV export, with the latest analysis joined in. */
export function queryLeads(db: Db, filters: LeadFilters) {
  return db
    .select({
      id: leads.id,
      name: leads.name,
      city: leads.city,
      address: leads.address,
      phone: leads.phone,
      phoneE164: leads.phoneE164,
      website: leads.website,
      siteStatus: leads.siteStatus,
      rating: leads.rating,
      reviewCount: leads.reviewCount,
      mapsUrl: leads.mapsUrl,
      score: leads.score,
      status: leads.status,
      analysisStatus: leads.analysisStatus,
      notes: leads.notes,
      createdAt: leads.createdAt,
      summary: analyses.summary,
      painPoints: analyses.painPoints,
      firstMessage: analyses.firstMessage,
    })
    .from(leads)
    .leftJoin(analyses, and(eq(analyses.leadId, leads.id), latestAnalysis))
    .where(whereClause(filters))
    .orderBy(...orderBy(filters))
    .limit(LIST_LIMIT);
}

export type LeadRow = Awaited<ReturnType<typeof queryLeads>>[number];

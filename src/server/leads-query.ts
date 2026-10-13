import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@/db/client";
import { analyses, leads } from "@/db/schema";
import { localDay } from "@/lib/format";
import { SCORE_TIERS, type LeadFilters, type LeadView, type ScoreTier } from "@/lib/schemas";

/** Rows shown in the leads table; the UI asks for narrower filters past this. */
export const LIST_LIMIT = 1000;
/** Rows in one CSV export. */
export const EXPORT_LIMIT = 10_000;

const SORT_COLUMNS = {
  score: leads.score,
  name: leads.name,
  rating: leads.rating,
  reviewCount: leads.reviewCount,
  createdAt: leads.createdAt,
} as const;

// Latest analysis per lead (re-analysis keeps history).
export const latestAnalysis = sql`${analyses.id} = (
  select a2.id from analyses a2 where a2.lead_id = ${leads.id}
  order by a2.created_at desc, a2.rowid desc limit 1
)`;

function viewCondition(view: LeadView | undefined, today: string): SQL | undefined {
  switch (view) {
    case "todo":
      return eq(leads.status, "new");
    case "followup":
      return and(inArray(leads.status, ["contacted", "replied"]), lte(leads.followUpOn, today));
    case "waiting":
      return eq(leads.status, "contacted");
    case "talking":
      return eq(leads.status, "replied");
    case "closed":
      return eq(leads.status, "closed");
    case "discarded":
      return eq(leads.status, "discarded");
    default:
      return undefined;
  }
}

/** Escapes LIKE wildcards so the search text matches literally (paired with `escape '\'`). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Matches the listed lead ids with a single bound parameter (D1 caps them at 100). */
export function leadIdIn(ids: readonly string[]) {
  return sql`${leads.id} in (select value from json_each(${JSON.stringify(ids)}))`;
}

/** The list filters, or (for "Exportar seleção") the selected leads. */
export type LeadQuery = LeadFilters & { ids?: readonly string[] };

function whereClause(filters: LeadQuery, today: string): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    filters.ids ? leadIdIn(filters.ids) : undefined,
    filters.q ? sql`${leads.name} like ${`%${escapeLike(filters.q)}%`} escape '\\'` : undefined,
    filters.searchId ? eq(leads.searchId, filters.searchId) : undefined,
    viewCondition(filters.view, today),
    filters.minScore !== undefined ? gte(leads.score, filters.minScore) : undefined,
    filters.maxScore !== undefined ? lte(leads.score, filters.maxScore) : undefined,
    filters.noWebsite ? isNull(leads.website) : undefined,
    filters.hasEmail ? isNotNull(leads.email) : undefined,
  ];
  return and(...conditions);
}

function orderBy(filters: LeadFilters) {
  // Follow-up queues default to the oldest due day first.
  if (!filters.sort && (filters.view === "followup" || filters.view === "waiting")) {
    const day = filters.dir === "desc" ? desc : asc;
    return [sql`${leads.followUpOn} is null`, day(leads.followUpOn), desc(leads.score)];
  }
  const column = SORT_COLUMNS[filters.sort ?? "score"];
  const direction = (filters.dir ?? "desc") === "desc" ? desc : asc;
  // Unanalyzed leads (null score) go last regardless of direction.
  return [sql`${column} is null`, direction(column), asc(leads.name)];
}

/**
 * Lead rows for the table and the CSV export, with the latest analysis joined in.
 * Returns at most `limit` rows; use queryLeadsCapped to know whether more matched.
 */
export function queryLeads(
  db: Db,
  filters: LeadQuery,
  today = localDay(new Date()),
  limit = LIST_LIMIT,
) {
  return db
    .select({
      id: leads.id,
      name: leads.name,
      city: leads.city,
      address: leads.address,
      phone: leads.phone,
      phoneE164: leads.phoneE164,
      website: leads.website,
      email: leads.email,
      unsubscribedAt: leads.unsubscribedAt,
      siteStatus: leads.siteStatus,
      rating: leads.rating,
      reviewCount: leads.reviewCount,
      mapsUrl: leads.mapsUrl,
      score: leads.score,
      status: leads.status,
      analysisStatus: leads.analysisStatus,
      notes: leads.notes,
      contactedAt: leads.contactedAt,
      followUpOn: leads.followUpOn,
      createdAt: leads.createdAt,
      summary: analyses.summary,
      signals: analyses.signals,
      painPoints: analyses.painPoints,
      firstMessage: analyses.firstMessage,
    })
    .from(leads)
    .leftJoin(analyses, and(eq(analyses.leadId, leads.id), latestAnalysis))
    .where(whereClause(filters, today))
    .orderBy(...orderBy(filters))
    .limit(limit);
}

export type LeadRow = Awaited<ReturnType<typeof queryLeads>>[number];

/** Like queryLeads, but reports whether rows past `limit` were left out. */
export async function queryLeadsCapped(
  db: Db,
  filters: LeadQuery,
  limit: number,
  today = localDay(new Date()),
): Promise<{ rows: LeadRow[]; truncated: boolean }> {
  const rows = await queryLeads(db, filters, today, limit + 1);
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

export type LeadCounts = {
  byView: Record<LeadView, number>;
  byTier: Record<ScoreTier, number>;
  pending: number;
};

const countIf = (condition: SQL) =>
  sql<number>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`.mapWith(Number);

/**
 * Counts for the queues and score bands. Queue counts ignore the view filter;
 * band counts ignore the score range.
 */
export async function countLeads(
  db: Db,
  filters: LeadFilters,
  today = localDay(new Date()),
): Promise<LeadCounts> {
  const viewCount = (view: LeadView) => {
    const condition = viewCondition(view, today);
    return condition ? countIf(condition) : sql<number>`count(*)`.mapWith(Number);
  };
  const [viewRows, tierRows] = await Promise.all([
    db
      .select({
        todo: viewCount("todo"),
        followup: viewCount("followup"),
        waiting: viewCount("waiting"),
        talking: viewCount("talking"),
        closed: viewCount("closed"),
        discarded: viewCount("discarded"),
        all: viewCount("all"),
        pending: countIf(eq(leads.analysisStatus, "pending")),
      })
      .from(leads)
      .where(whereClause({ ...filters, view: undefined }, today)),
    db
      .select({
        high: countIf(gte(leads.score, SCORE_TIERS.high.min)),
        medium: countIf(
          sql`${leads.score} between ${SCORE_TIERS.medium.min} and ${SCORE_TIERS.medium.max}`,
        ),
        low: countIf(lte(leads.score, SCORE_TIERS.low.max)),
      })
      .from(leads)
      .where(whereClause({ ...filters, minScore: undefined, maxScore: undefined }, today)),
  ]);

  const row = viewRows[0];
  const tiers = tierRows[0];
  return {
    byView: {
      todo: row?.todo ?? 0,
      followup: row?.followup ?? 0,
      waiting: row?.waiting ?? 0,
      talking: row?.talking ?? 0,
      closed: row?.closed ?? 0,
      discarded: row?.discarded ?? 0,
      all: row?.all ?? 0,
    },
    byTier: { high: tiers?.high ?? 0, medium: tiers?.medium ?? 0, low: tiers?.low ?? 0 },
    pending: row?.pending ?? 0,
  };
}

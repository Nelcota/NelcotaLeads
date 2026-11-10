import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@/db/client";
import { inList } from "@/db/in-list";
import { analyses, leads, users } from "@/db/schema";
import { localDay } from "@/lib/format";
import { leadNicheIs } from "./niches";
import {
  NO_OWNER,
  SCORE_TIERS,
  type LeadFilters,
  type LeadView,
  type ScoreTier,
} from "@/lib/schemas";

/** Rows shown in the leads table; the UI asks for narrower filters past this. */
export const LIST_LIMIT = 1000;
export { EXPORT_LIMIT } from "@/lib/schemas";

/** "Chegaram hoje": a lead created within this window counts as new today. */
export const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Fewest digits in the search text before it is also matched against phone numbers. */
const PHONE_SEARCH_MIN_DIGITS = 4;

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

// When the lead last wrote back (a real reply, not an auto-responder).
const lastReplyAt = sql<number | null>`(
  select max(e.created_at) from emails e
  where e.lead_id = ${leads.id} and e.direction = 'in' and e.automatic = 0
)`;

// The next meeting still to happen, for "Próximo passo" in Em conversa.
const nextMeetingAt = sql<number | null>`(
  select min(m.starts_at) from meetings m
  where m.lead_id = ${leads.id} and m.cancelled_at is null and m.starts_at >= unixepoch()
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
  return inList(leads.id, ids);
}

/**
 * The list filters, or (for "Exportar seleção") the selected leads. `ownerId` is what "Meus
 * leads" (`mine`) resolves to on the server; without it, `mine` matches nothing.
 */
export type LeadQuery = LeadFilters & { ids?: readonly string[]; ownerId?: string | null };

/** The search box: name, e-mail, address or city, and the phone when enough digits are typed. */
function searchCondition(q: string): SQL | undefined {
  const pattern = `%${escapeLike(q)}%`;
  const text = [leads.name, leads.email, leads.address, leads.city].map(
    (column) => sql`${column} like ${pattern} escape '\\'`,
  );
  const digits = q.replace(/\D/g, "");
  const phone =
    digits.length >= PHONE_SEARCH_MIN_DIGITS
      ? sql`replace(replace(replace(replace(${leads.phone}, ' ', ''), '-', ''), '(', ''), ')', '') like ${`%${digits}%`}`
      : undefined;
  return or(...text, phone);
}

function mineCondition(filters: LeadQuery): SQL | undefined {
  if (!filters.mine) return undefined;
  // Signed out (or not resolved): "Meus leads" shows nothing rather than everyone's.
  if (!filters.ownerId) return sql`0`;
  return eq(leads.ownerId, filters.ownerId);
}

/** `owner=<id>`: one partner's leads; `owner=none`: the leads nobody took. */
function ownerCondition(owner: LeadFilters["owner"]): SQL | undefined {
  if (!owner) return undefined;
  if (owner === NO_OWNER) return isNull(leads.ownerId);
  return eq(leads.ownerId, owner);
}

function whereClause(filters: LeadQuery, today: string, now: Date): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    filters.ids ? leadIdIn(filters.ids) : undefined,
    filters.q ? searchCondition(filters.q) : undefined,
    filters.searchId ? eq(leads.searchId, filters.searchId) : undefined,
    filters.niche ? leadNicheIs(filters.niche) : undefined,
    viewCondition(filters.view, today),
    filters.minScore !== undefined ? gte(leads.score, filters.minScore) : undefined,
    filters.maxScore !== undefined ? lte(leads.score, filters.maxScore) : undefined,
    filters.noWebsite ? isNull(leads.website) : undefined,
    filters.hasEmail ? isNotNull(leads.email) : undefined,
    filters.fresh ? gte(leads.createdAt, new Date(now.getTime() - FRESH_WINDOW_MS)) : undefined,
    mineCondition(filters),
    ownerCondition(filters.owner),
    filters.stage ? eq(leads.salesStage, filters.stage) : undefined,
  ];
  return and(...conditions);
}

/** The order each queue opens in when the user has not picked a column. */
function viewOrder(view: LeadView | undefined, dir: LeadFilters["dir"]): SQL[] | undefined {
  switch (view) {
    // Overdue first: the oldest due day leads the list.
    case "followup": {
      const day = dir === "desc" ? desc : asc;
      return [sql`${leads.followUpOn} is null`, day(leads.followUpOn), desc(leads.score)];
    }
    // Waiting longest first: the oldest e-mail sent.
    case "waiting": {
      const sent = sql`coalesce(${leads.lastEmailAt}, ${leads.contactedAt})`;
      const order = dir === "desc" ? desc : asc;
      return [sql`${sent} is null`, order(sent), desc(leads.score)];
    }
    // The newest reply first.
    case "talking": {
      const order = dir === "asc" ? asc : desc;
      return [sql`${lastReplyAt} is null`, order(lastReplyAt), desc(leads.score)];
    }
    // "Todos" keeps the order of the tabs: to contact, waiting, in conversation, closed, discarded.
    case "all": {
      const stage = sql`case ${leads.status}
        when 'new' then 0 when 'contacted' then 1 when 'replied' then 2
        when 'closed' then 3 else 4 end`;
      return [asc(stage), sql`${leads.score} is null`, desc(leads.score), asc(leads.name)];
    }
    default:
      return undefined;
  }
}

function orderBy(filters: LeadFilters) {
  const byView = filters.sort ? undefined : viewOrder(filters.view, filters.dir);
  if (byView) return byView;
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
  now = new Date(),
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
      salesStage: leads.salesStage,
      analysisStatus: leads.analysisStatus,
      notes: leads.notes,
      contactedAt: leads.contactedAt,
      lastEmailAt: leads.lastEmailAt,
      followUpOn: leads.followUpOn,
      createdAt: leads.createdAt,
      ownerId: leads.ownerId,
      ownerName: users.name,
      ownerAvatar: users.avatar,
      lastReplyAt: sql<number | null>`${lastReplyAt}`.mapWith((value: number | null) =>
        value === null ? null : new Date(value * 1000),
      ),
      nextMeetingAt: sql<number | null>`${nextMeetingAt}`.mapWith((value: number | null) =>
        value === null ? null : new Date(value * 1000),
      ),
      summary: analyses.summary,
      signals: analyses.signals,
      painPoints: analyses.painPoints,
      firstMessage: analyses.firstMessage,
    })
    .from(leads)
    .leftJoin(analyses, and(eq(analyses.leadId, leads.id), latestAnalysis))
    .leftJoin(users, eq(users.id, leads.ownerId))
    .where(whereClause(filters, today, now))
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
  /** Follow-ups whose day already passed (part of "Retornar hoje"). */
  overdue: number;
};

const countIf = (condition: SQL) =>
  sql<number>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`.mapWith(Number);

/**
 * Counts for the queues and score bands. Queue counts ignore the view filter;
 * band counts ignore the score range.
 */
export async function countLeads(
  db: Db,
  filters: LeadQuery,
  today = localDay(new Date()),
  now = new Date(),
): Promise<LeadCounts> {
  const viewCount = (view: LeadView) => {
    const condition = viewCondition(view, today);
    return condition ? countIf(condition) : sql<number>`count(*)`.mapWith(Number);
  };
  const overdue = and(inArray(leads.status, ["contacted", "replied"]), lt(leads.followUpOn, today));
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
        overdue: overdue ? countIf(overdue) : sql<number>`0`.mapWith(Number),
      })
      .from(leads)
      .where(whereClause({ ...filters, view: undefined }, today, now)),
    db
      .select({
        high: countIf(gte(leads.score, SCORE_TIERS.high.min)),
        medium: countIf(
          sql`${leads.score} between ${SCORE_TIERS.medium.min} and ${SCORE_TIERS.medium.max}`,
        ),
        low: countIf(lte(leads.score, SCORE_TIERS.low.max)),
      })
      .from(leads)
      .where(whereClause({ ...filters, minScore: undefined, maxScore: undefined }, today, now)),
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
    overdue: row?.overdue ?? 0,
  };
}

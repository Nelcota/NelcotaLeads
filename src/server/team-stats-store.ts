import { and, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, meetings, proposals } from "@/db/schema";
import type { DayRange } from "@/lib/period";

type Range = Pick<DayRange, "from" | "to">;

/** A count per person id; people without rows are simply missing (read them as zero). */
export type CountByOwner = ReadonlyMap<string, number>;

/** Leads someone is working: contacted or replied ("Leads ativos", decided 2026-11-09). */
export const WORKED_STATUSES = ["contacted", "replied"] as const;

/**
 * Credit goes to who did it (decided 2026-11-09), so a later owner change does not move past
 * numbers: the person who booked the meeting or built the proposal; the lead's owner only when
 * that was not recorded.
 */
const meetingActor = sql<string | null>`coalesce(${meetings.createdBy}, ${leads.ownerId})`;
const proposalActor = sql<string | null>`coalesce(${proposals.createdBy}, ${leads.ownerId})`;

/**
 * Who closed a deal: the person on its latest "won" history event, else the lead's owner.
 * Spelled out: inside a one-table select drizzle leaves column names unqualified.
 */
const closer = sql<string | null>`coalesce(
  (select e.user_id from lead_events e
   where e.lead_id = "leads"."id" and e.kind = 'won'
   order by e.created_at desc limit 1),
  "leads"."owner_id"
)`;

function toMap<T>(rows: readonly { owner: string | null; value: T }[]): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (row.owner) map.set(row.owner, row.value);
  }
  return map;
}

/** "Leads ativos" (contacted or replied) and "Em conversa" (replied), per owner, right now. */
export async function heldByOwner(db: Db) {
  const rows = await db
    .select({
      owner: leads.ownerId,
      held: sql<number>`sum(case when ${leads.status} in ('contacted', 'replied') then 1 else 0 end)`.mapWith(
        Number,
      ),
      talking: sql<number>`sum(case when ${leads.status} = 'replied' then 1 else 0 end)`.mapWith(
        Number,
      ),
    })
    .from(leads)
    .where(isNotNull(leads.ownerId))
    .groupBy(leads.ownerId);
  return toMap(
    rows.map((row) => ({ owner: row.owner, value: { held: row.held, talking: row.talking } })),
  );
}

/** Deals still won that closed within the range, and their value, per person who closed them. */
export async function wonByOwner(db: Db, range: Range) {
  const rows = await db
    .select({
      owner: closer,
      deals: sql<number>`count(*)`.mapWith(Number),
      revenueCents: sql<number>`coalesce(sum(${leads.dealValueCents}), 0)`.mapWith(Number),
    })
    .from(leads)
    .where(
      and(
        eq(leads.status, "closed"),
        gte(leads.closedAt, range.from),
        lt(leads.closedAt, range.to),
      ),
    )
    .groupBy(closer);
  return toMap(
    rows.map((row) => ({
      owner: row.owner,
      value: { deals: row.deals, revenueCents: row.revenueCents },
    })),
  );
}

/** Meetings booked within the range and not cancelled, per person who booked them. */
export async function meetingsByOwner(db: Db, range: Range): Promise<CountByOwner> {
  const rows = await db
    .select({ owner: meetingActor, value: sql<number>`count(*)`.mapWith(Number) })
    .from(meetings)
    .innerJoin(leads, eq(leads.id, meetings.leadId))
    .where(
      and(
        isNull(meetings.cancelledAt),
        gte(meetings.createdAt, range.from),
        lt(meetings.createdAt, range.to),
      ),
    )
    .groupBy(meetingActor);
  return toMap(rows);
}

/** Proposals made within the range, per person who built them. */
export async function proposalsByOwner(db: Db, range: Range): Promise<CountByOwner> {
  const rows = await db
    .select({ owner: proposalActor, value: sql<number>`count(*)`.mapWith(Number) })
    .from(proposals)
    .innerJoin(leads, eq(leads.id, proposals.leadId))
    .where(and(gte(proposals.createdAt, range.from), lt(proposals.createdAt, range.to)))
    .groupBy(proposalActor);
  return toMap(rows);
}

/**
 * Free leads someone should take: contacted or replied, with nobody on them. New ones stay out
 * (decided 2026-11-09): they go through the daily dispatch first.
 */
export const freeLeadCondition = and(
  isNull(leads.ownerId),
  inArray(leads.status, [...WORKED_STATUSES]),
);

/** New leads nobody took yet, counted on the card as "mais N novos no disparo". */
export const freeNewCondition = and(isNull(leads.ownerId), eq(leads.status, "new"));

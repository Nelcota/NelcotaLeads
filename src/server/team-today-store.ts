import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, meetings } from "@/db/schema";
import { needsYou } from "./dashboard";

/** Leads waiting for a follow-up, the same ones as "Retornar hoje" in Leads. */
const FOLLOW_UP_STATUSES = ["contacted", "replied"] as const;

const meetingOwner = sql<string | null>`coalesce(${leads.ownerId}, ${meetings.createdBy})`;

export type NextMeeting = { leadId: string; leadName: string; startsAt: Date };

/** Follow-ups due today and overdue ones, per owner (`today` is a Brazil day). */
export async function followUpsByOwner(db: Db, today: string) {
  const rows = await db
    .select({
      owner: leads.ownerId,
      due: sql<number>`sum(case when ${leads.followUpOn} = ${today} then 1 else 0 end)`.mapWith(
        Number,
      ),
      late: sql<number>`sum(case when ${leads.followUpOn} < ${today} then 1 else 0 end)`.mapWith(
        Number,
      ),
    })
    .from(leads)
    .where(
      and(
        isNotNull(leads.ownerId),
        inArray(leads.status, [...FOLLOW_UP_STATUSES]),
        lte(leads.followUpOn, today),
      ),
    )
    .groupBy(leads.ownerId);
  const map = new Map<string, { due: number; late: number }>();
  for (const row of rows) {
    if (row.owner) map.set(row.owner, { due: row.due, late: row.late });
  }
  return map;
}

/** Conversations the AI handed to a person, per owner ("Precisa de você" in Conversas). */
export async function waitingByOwner(db: Db) {
  const rows = await db
    .select({ owner: leads.ownerId, count: sql<number>`count(*)`.mapWith(Number) })
    .from(leads)
    .where(and(needsYou, isNotNull(leads.ownerId)))
    .groupBy(leads.ownerId);
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.owner) map.set(row.owner, row.count);
  }
  return map;
}

/** Each partner's next meeting still to happen (the earliest one). */
export async function nextMeetingByOwner(db: Db, now: Date) {
  const rows = await db
    .select({
      owner: meetingOwner,
      leadId: leads.id,
      leadName: leads.name,
      startsAt: meetings.startsAt,
    })
    .from(meetings)
    .innerJoin(leads, eq(leads.id, meetings.leadId))
    .where(and(isNull(meetings.cancelledAt), gte(meetings.startsAt, now)))
    .orderBy(asc(meetings.startsAt));
  const map = new Map<string, NextMeeting>();
  for (const row of rows) {
    if (!row.owner || map.has(row.owner)) continue;
    map.set(row.owner, { leadId: row.leadId, leadName: row.leadName, startsAt: row.startsAt });
  }
  return map;
}

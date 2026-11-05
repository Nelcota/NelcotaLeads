import { and, asc, countDistinct, eq, gte, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, meetings, users } from "@/db/schema";
import type { AgendaEntry } from "@/lib/agenda";
import { addDays, brazilInstant, localDay, localTime } from "@/lib/format";

/** Who a meeting belongs to: the lead's owner, or who booked it while the lead was free. */
const meetingOwner = sql<string | null>`coalesce(${leads.ownerId}, ${meetings.createdBy})`;

/** Leads waiting for a follow-up, the same ones as "Retornar hoje" in Leads. */
const FOLLOW_UP_STATUSES = ["contacted", "replied"] as const;

type Range = { from: string; to: string; ownerId: string | null };

async function meetingEntries(db: Db, { from, to, ownerId }: Range): Promise<AgendaEntry[]> {
  const rows = await db
    .select({
      id: meetings.id,
      leadId: meetings.leadId,
      leadName: leads.name,
      startsAt: meetings.startsAt,
      kind: meetings.kind,
      note: meetings.note,
      ownerName: users.name,
    })
    .from(meetings)
    .innerJoin(leads, eq(leads.id, meetings.leadId))
    .leftJoin(users, eq(users.id, meetingOwner))
    .where(
      and(
        isNull(meetings.cancelledAt),
        // A lead given up on (by a person, the AI or an opt-out) has nothing left to meet about.
        ne(leads.status, "discarded"),
        gte(meetings.startsAt, brazilInstant(from, "00:00")),
        lt(meetings.startsAt, brazilInstant(addDays(to, 1), "00:00")),
        ownerId ? sql`${meetingOwner} = ${ownerId}` : undefined,
      ),
    )
    .orderBy(asc(meetings.startsAt));
  return rows.map((row) => ({
    id: row.id,
    kind: "meeting",
    leadId: row.leadId,
    leadName: row.leadName,
    day: localDay(row.startsAt),
    time: localTime(row.startsAt),
    meetingKind: row.kind,
    ownerName: row.ownerName,
    note: row.note,
  }));
}

/**
 * Follow-ups due until `to`, overdue ones included (no lower bound): a lead whose return day
 * passed is still waiting, the same as Leads → "Retornar hoje".
 */
async function followUpEntries(db: Db, { to, ownerId }: Range): Promise<AgendaEntry[]> {
  const rows = await db
    .select({ id: leads.id, name: leads.name, day: leads.followUpOn, ownerName: users.name })
    .from(leads)
    .leftJoin(users, eq(users.id, leads.ownerId))
    .where(
      and(
        inArray(leads.status, FOLLOW_UP_STATUSES),
        lte(leads.followUpOn, to),
        ownerId ? eq(leads.ownerId, ownerId) : undefined,
      ),
    );
  return rows.flatMap((row) =>
    row.day
      ? [
          {
            id: `followup:${row.id}`,
            kind: "followup" as const,
            leadId: row.id,
            leadName: row.name,
            day: row.day,
            time: null,
            meetingKind: null,
            ownerName: row.ownerName,
            note: "",
          },
        ]
      : [],
  );
}

/**
 * Meetings from `from` to `to` (Brazil days, both included) and follow-ups due until `to`,
 * overdue ones included.
 */
export async function agendaEntries(db: Db, range: Range): Promise<AgendaEntry[]> {
  const [meetingRows, followUps] = await Promise.all([
    meetingEntries(db, range),
    followUpEntries(db, range),
  ]);
  return [...meetingRows, ...followUps];
}

/**
 * The tiles that do not come from the list: leads at Proposta (a proposal to present) and how
 * many of the leads with a meeting closed a deal.
 */
export async function agendaSummary(db: Db, ownerId: string | null) {
  const leadOwner = ownerId ? eq(leads.ownerId, ownerId) : undefined;
  const meetingOwnerIs = ownerId ? sql`${meetingOwner} = ${ownerId}` : undefined;
  const [proposalsToPresent, conversion] = await Promise.all([
    db.$count(leads, and(eq(leads.status, "replied"), eq(leads.salesStage, "proposal"), leadOwner)),
    db
      .select({
        withMeeting: countDistinct(leads.id),
        closed: countDistinct(sql`case when ${leads.status} = 'closed' then ${leads.id} end`),
      })
      .from(meetings)
      .innerJoin(leads, eq(leads.id, meetings.leadId))
      .where(and(isNull(meetings.cancelledAt), meetingOwnerIs)),
  ]);
  return {
    proposalsToPresent,
    leadsWithMeeting: conversion[0]?.withMeeting ?? 0,
    closedAfterMeeting: conversion[0]?.closed ?? 0,
  };
}

/** The people who can own a lead, for the Agenda's filter. */
export function teamMembers(db: Db) {
  return db.select({ id: users.id, name: users.name }).from(users).orderBy(asc(users.name));
}

/**
 * Today's meetings and the follow-ups due today or overdue, of the whole team, for the sidebar
 * and the Visão geral (the same leads as Leads → "Retornar hoje").
 */
export function todayEntries(db: Db, now = new Date()) {
  const today = localDay(now);
  return agendaEntries(db, { from: today, to: today, ownerId: null });
}

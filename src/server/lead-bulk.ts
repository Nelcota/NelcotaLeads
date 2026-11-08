import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leadEvents, leads, type Lead, type LeadStatus } from "@/db/schema";
import { localDay } from "@/lib/format";
import type { BulkSnapshot } from "@/lib/schemas";
import { leadEvent, type LeadEventRow } from "./lead-events";
import { leadPatch, OUTREACH_STATUSES } from "./lead-status";
import { leadIdIn } from "./leads-query";
import { cancelFutureMeetings } from "./meeting-store";

/** Chunks of statements per D1 batch. */
const BATCH_SIZE = 50;

const toSeconds = (date: Date | null) => (date ? Math.floor(date.getTime() / 1000) : null);
const fromSeconds = (seconds: number | null) =>
  seconds === null ? null : new Date(seconds * 1000);

/** What "Desfazer" needs to put the lead back: its status and the deal's columns. */
function bulkSnapshot(lead: Lead): BulkSnapshot {
  return {
    id: lead.id,
    status: lead.status,
    followUpOn: lead.followUpOn,
    discardReason: lead.discardReason,
    discardedAt: toSeconds(lead.discardedAt),
    closedAt: toSeconds(lead.closedAt),
    dealValueCents: lead.dealValueCents,
    dealService: lead.dealService,
    lossReason: lead.lossReason,
    lossNote: lead.lossNote,
    lostAt: toSeconds(lead.lostAt),
    salesStage: lead.salesStage,
    contactedAt: toSeconds(lead.contactedAt),
  };
}

/** The columns the undo writes back, the deal included. */
function restoredColumns(snapshot: BulkSnapshot) {
  return {
    status: snapshot.status,
    followUpOn: snapshot.followUpOn,
    discardReason: snapshot.discardReason,
    discardedAt: fromSeconds(snapshot.discardedAt),
    closedAt: fromSeconds(snapshot.closedAt),
    dealValueCents: snapshot.dealValueCents,
    dealService: snapshot.dealService,
    lossReason: snapshot.lossReason,
    lossNote: snapshot.lossNote,
    lostAt: fromSeconds(snapshot.lostAt),
    salesStage: snapshot.salesStage,
    // Older snapshots (before the column was carried) leave the date as it is.
    ...(snapshot.contactedAt === undefined
      ? {}
      : { contactedAt: fromSeconds(snapshot.contactedAt) }),
  };
}

/** Why each skipped lead did not move, so the toast can say it. */
export type BulkSkips = {
  /** Already in the target status. */
  alreadyThere: number;
  /** The status rules (LEAD_TRANSITIONS, the opt-out) refuse the move. */
  notAllowed: number;
  /** In conversation: a discard needs its loss reason, through the lead panel. */
  needsReason: number;
};

export type BulkResult = BulkSkips & {
  changed: number;
  /** Everything that did not change, ids that no longer exist included. */
  skipped: number;
  previous: BulkSnapshot[];
};

/** A guarded status update that returns the id of the lead it changed. */
function guardedUpdate(db: Db, id: string, from: LeadStatus, columns: Partial<Lead>) {
  return db
    .update(leads)
    .set(columns)
    .where(and(eq(leads.id, id), eq(leads.status, from)))
    .returning({ id: leads.id });
}

/** Runs the updates in D1-sized batches and returns the ids that really changed. */
async function runUpdates(db: Db, updates: ReturnType<typeof guardedUpdate>[]) {
  const ids: string[] = [];
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const [first, ...rest] = updates.slice(i, i + BATCH_SIZE);
    if (first === undefined) continue;
    const results = await db.batch([first, ...rest]);
    for (const row of results.flat()) ids.push(row.id);
  }
  return ids;
}

/** D1 binds at most 100 values per query; an event row has 7 columns. */
const EVENTS_PER_INSERT = 14;

/** The status change of each lead goes to its history, with who made it. */
async function writeEvents(db: Db, events: LeadEventRow[]) {
  const inserts = [];
  for (let i = 0; i < events.length; i += EVENTS_PER_INSERT) {
    inserts.push(db.insert(leadEvents).values(events.slice(i, i + EVENTS_PER_INSERT)));
  }
  for (let i = 0; i < inserts.length; i += BATCH_SIZE) {
    const [first, ...rest] = inserts.slice(i, i + BATCH_SIZE);
    if (first === undefined) continue;
    await db.batch([first, ...rest]);
  }
}

/**
 * Moves the selected leads to `status`, one by one through the same rules as the lead panel
 * (LEAD_TRANSITIONS and the opt-out). Leads already there, or that may not move, are skipped
 * and counted by reason. Like the panel, it writes the change to each lead's history and
 * cancels the meetings of a lead that was closed or discarded. Returns what each changed lead
 * had before, for "Desfazer".
 */
export async function bulkUpdateLeads(
  db: Db,
  ids: readonly string[],
  status: LeadStatus,
  now = new Date(),
  userId: string | null = null,
): Promise<BulkResult> {
  const unique = [...new Set(ids)];
  const rows = await db.select().from(leads).where(leadIdIn(unique));
  const today = localDay(now);
  const skips: BulkSkips = { alreadyThere: 0, notAllowed: 0, needsReason: 0 };
  const updates = [];
  const snapshots: BulkSnapshot[] = [];
  for (const lead of rows) {
    if (lead.status === status) {
      skips.alreadyThere += 1;
      continue;
    }
    // The panel records a loss reason for a lead in conversation; the loss metrics count it.
    if (status === "discarded" && lead.status === "replied") {
      skips.needsReason += 1;
      continue;
    }
    let patch;
    try {
      patch = leadPatch(lead, { id: lead.id, status }, now, today);
    } catch {
      skips.notAllowed += 1;
      continue;
    }
    // Only applies if nobody (e.g. the mail flow) changed the status since it was read.
    updates.push(guardedUpdate(db, lead.id, lead.status, patch));
    snapshots.push(bulkSnapshot(lead));
  }
  const changedIds = new Set(await runUpdates(db, updates));
  const previous = snapshots.filter((snapshot) => changedIds.has(snapshot.id));
  await writeEvents(
    db,
    previous.map((snapshot) =>
      leadEvent(snapshot.id, "status", { from: snapshot.status, to: status }, userId, now),
    ),
  );
  // An ended lead has nothing left to meet about.
  if (status === "closed" || status === "discarded") {
    for (const snapshot of previous) await cancelFutureMeetings(db, snapshot.id, now);
  }
  return {
    changed: previous.length,
    skipped: unique.length - previous.length,
    ...skips,
    previous,
  };
}

/**
 * Puts leads changed by a bulk action back as they were, outside the normal status rules (a
 * discarded lead may only go to "new" otherwise). Leads someone moved since then are left
 * alone, and an opted-out lead never goes back into the outreach queues. The history gets the
 * way back, so it never shows a change that was undone as if it stood.
 */
export async function undoBulkUpdate(
  db: Db,
  status: LeadStatus,
  previous: BulkSnapshot[],
  now = new Date(),
  userId: string | null = null,
) {
  const rows = await db
    .select({ id: leads.id, status: leads.status, unsubscribedAt: leads.unsubscribedAt })
    .from(leads)
    .where(leadIdIn(previous.map((snapshot) => snapshot.id)));
  const current = new Map(rows.map((row) => [row.id, row]));
  const updates = [];
  const restoredStatus = new Map<string, LeadStatus>();
  for (const snapshot of previous) {
    const lead = current.get(snapshot.id);
    if (!lead || lead.status !== status) continue;
    // The opt-out still applies; the transition table does not (that is the undo).
    if (lead.unsubscribedAt && OUTREACH_STATUSES.includes(snapshot.status)) continue;
    updates.push(guardedUpdate(db, snapshot.id, status, restoredColumns(snapshot)));
    restoredStatus.set(snapshot.id, snapshot.status);
  }
  const restoredIds = await runUpdates(db, updates);
  await writeEvents(
    db,
    restoredIds.map((id) =>
      leadEvent(id, "status", { from: status, to: restoredStatus.get(id) ?? null }, userId, now),
    ),
  );
  return { restored: restoredIds.length };
}

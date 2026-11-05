import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, type Lead, type LeadStatus } from "@/db/schema";
import { localDay } from "@/lib/format";
import type { BulkSnapshot } from "@/lib/schemas";
import { leadPatch, OUTREACH_STATUSES } from "./lead-status";
import { leadIdIn } from "./leads-query";

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
  };
}

/**
 * Moves the selected leads to `status`, one by one through the same rules as the lead panel
 * (LEAD_TRANSITIONS and the opt-out). Leads already there, or that may not move, are skipped
 * and counted. Returns what each changed lead had before, for "Desfazer".
 */
export async function bulkUpdateLeads(
  db: Db,
  ids: readonly string[],
  status: LeadStatus,
  now = new Date(),
) {
  const unique = [...new Set(ids)];
  const rows = await db.select().from(leads).where(leadIdIn(unique));
  const today = localDay(now);
  const updates = [];
  const snapshots: BulkSnapshot[] = [];
  for (const lead of rows) {
    if (lead.status === status) continue;
    let patch;
    try {
      patch = leadPatch(lead, { id: lead.id, status }, now, today);
    } catch {
      continue;
    }
    // Only applies if nobody (e.g. the mail flow) changed the status since it was read.
    updates.push(
      db
        .update(leads)
        .set(patch)
        .where(and(eq(leads.id, lead.id), eq(leads.status, lead.status)))
        .returning({ id: leads.id }),
    );
    snapshots.push(bulkSnapshot(lead));
  }
  const changedIds = new Set<string>();
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const [first, ...rest] = updates.slice(i, i + BATCH_SIZE);
    if (first === undefined) continue;
    const results = await db.batch([first, ...rest]);
    for (const row of results.flat()) changedIds.add(row.id);
  }
  const previous = snapshots.filter((snapshot) => changedIds.has(snapshot.id));
  return { changed: previous.length, skipped: unique.length - previous.length, previous };
}

/**
 * Puts leads changed by a bulk action back as they were, outside the normal status rules (a
 * discarded lead may only go to "new" otherwise). Leads someone moved since then are left
 * alone, and an opted-out lead never goes back into the outreach queues.
 */
export async function undoBulkUpdate(db: Db, status: LeadStatus, previous: BulkSnapshot[]) {
  const rows = await db
    .select({ id: leads.id, status: leads.status, unsubscribedAt: leads.unsubscribedAt })
    .from(leads)
    .where(leadIdIn(previous.map((snapshot) => snapshot.id)));
  const current = new Map(rows.map((row) => [row.id, row]));
  const updates = [];
  for (const snapshot of previous) {
    const lead = current.get(snapshot.id);
    if (!lead || lead.status !== status) continue;
    // The opt-out still applies; the transition table does not (that is the undo).
    if (lead.unsubscribedAt && OUTREACH_STATUSES.includes(snapshot.status)) continue;
    updates.push(
      db
        .update(leads)
        .set(restoredColumns(snapshot))
        .where(and(eq(leads.id, snapshot.id), eq(leads.status, status)))
        .returning({ id: leads.id }),
    );
  }
  let restored = 0;
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const [first, ...rest] = updates.slice(i, i + BATCH_SIZE);
    if (first === undefined) continue;
    restored += (await db.batch([first, ...rest])).flat().length;
  }
  return { restored };
}

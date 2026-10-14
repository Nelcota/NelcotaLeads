import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, type LeadStatus } from "@/db/schema";
import { localDay } from "@/lib/format";
import type { BulkSnapshot } from "@/lib/schemas";
import { leadPatch, OUTREACH_STATUSES } from "./lead-status";
import { leadIdIn } from "./leads-query";

/** Chunks of statements per D1 batch. */
const BATCH_SIZE = 50;

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
    snapshots.push({
      id: lead.id,
      status: lead.status,
      followUpOn: lead.followUpOn,
      discardReason: lead.discardReason,
      discardedAt: lead.discardedAt ? Math.floor(lead.discardedAt.getTime() / 1000) : null,
    });
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
        .set({
          status: snapshot.status,
          followUpOn: snapshot.followUpOn,
          discardReason: snapshot.discardReason,
          discardedAt: snapshot.discardedAt === null ? null : new Date(snapshot.discardedAt * 1000),
        })
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

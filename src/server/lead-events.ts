import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leadEvents, users, type LeadEventKind, type LeadStatus } from "@/db/schema";
import type { HistoryEvent } from "@/lib/lead-history";

export type LeadEventRow = typeof leadEvents.$inferInsert;

/** Events shown in the lead panel's history. */
export const HISTORY_LIMIT = 20;

/**
 * One history row. `createdAt` is set here, not by the database, so the events written by one
 * action share the instant (the history uses that to pair a deal with its status change).
 */
export function leadEvent(
  leadId: string,
  kind: LeadEventKind,
  change: { from?: string | null; to?: string | null },
  userId: string | null,
  now: Date,
): LeadEventRow {
  return {
    id: crypto.randomUUID(),
    leadId,
    kind,
    fromValue: change.from ?? null,
    toValue: change.to ?? null,
    userId,
    createdAt: now,
  };
}

/** The status event for a change, or none when the status stays the same. */
export function statusEvents(
  leadId: string,
  from: LeadStatus,
  to: LeadStatus | undefined,
  userId: string | null,
  now: Date,
): LeadEventRow[] {
  if (!to || to === from) return [];
  return [leadEvent(leadId, "status", { from, to }, userId, now)];
}

/** The lead's latest events, newest first, with the name of who did each one. */
export function leadHistory(
  db: Db,
  leadId: string,
  limit = HISTORY_LIMIT,
): Promise<HistoryEvent[]> {
  return db
    .select({
      id: leadEvents.id,
      kind: leadEvents.kind,
      fromValue: leadEvents.fromValue,
      toValue: leadEvents.toValue,
      userName: users.name,
      createdAt: leadEvents.createdAt,
    })
    .from(leadEvents)
    .leftJoin(users, eq(users.id, leadEvents.userId))
    .where(eq(leadEvents.leadId, leadId))
    .orderBy(desc(leadEvents.createdAt), desc(leadEvents.id))
    .limit(limit);
}

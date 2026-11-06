import { and, eq, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { inList } from "@/db/in-list";
import { emails, leadEvents, leads } from "@/db/schema";
import { addDays, brazilInstant, localDay } from "@/lib/format";
import type { SendWindowInput } from "@/lib/schemas";
import { leadPatch } from "./lead-status";
import { statusEvents } from "./lead-events";
import {
  DISPATCH_CANCELLED_REASON,
  isFirstOutreach,
  reslotColdQueue,
  wasContacted,
} from "./mail-flow";
import { writeDispatchControl } from "./settings-store";

/**
 * First e-mails still waiting in the queue for today ("que ainda não saíram hoje"): due before
 * tomorrow 00:00 Brazil time and not picked up by a running send. Later slots are left alone.
 */
export function cancellableFirstEmails(now: Date) {
  const tomorrow = brazilInstant(addDays(localDay(now), 1), "00:00");
  return and(
    eq(emails.status, "queued"),
    isNull(emails.sentAt),
    lt(emails.sendAfter, tomorrow),
    isFirstOutreach,
  );
}

/** Stops first e-mails and follow-ups from going out until `resumeDispatch`. */
export async function pauseDispatch(db: Db, now: Date) {
  await writeDispatchControl(db, { dispatchPausedAt: now });
}

export async function resumeDispatch(db: Db) {
  await writeDispatchControl(db, { dispatchPausedAt: null });
}

/** Stores the new hours and moves the cold e-mails already queued inside them. */
export async function saveSendWindow(db: Db, window: SendWindowInput, now = new Date()) {
  await writeDispatchControl(db, { sendWindowStart: window.start, sendWindowEnd: window.end });
  await reslotColdQueue(db, now);
}

/**
 * Takes the first e-mails still waiting out of the queue. Answers in a conversation,
 * follow-ups and anything already sent (or being sent) stay as they are. The cancel instant
 * goes in `send_after`, so the automatic dispatch knows not to draft these leads again today.
 */
async function cancelQueuedFirstEmails(db: Db, now: Date) {
  return db
    .update(emails)
    .set({ status: "cancelled", error: DISPATCH_CANCELLED_REASON, sendAfter: now })
    .where(cancellableFirstEmails(now))
    .returning({ leadId: emails.leadId });
}

/**
 * Leads of the cancelled e-mails that left "A contatar" without ever being contacted go back
 * to it; one contacted some other way (WhatsApp, a sent e-mail) or discarded keeps its status.
 * Usually a no-op: a lead only becomes contacted when its first e-mail goes out.
 */
async function returnLeadsToNew(db: Db, leadIds: string[], userId: string | null, now: Date) {
  if (leadIds.length === 0) return;
  const moved = await db
    .select()
    .from(leads)
    .where(
      and(
        inList(leads.id, leadIds),
        // Marked contacted without a contact date or a sent e-mail: never really contacted.
        // A discarded lead stays discarded (a person decided that).
        eq(leads.status, "contacted"),
        isNull(leads.contactedAt),
        isNull(leads.unsubscribedAt),
        sql`not ${wasContacted(leads.id)}`,
      ),
    );
  if (moved.length === 0) return;
  const today = localDay(now);
  const updates = moved.map((lead) =>
    db
      .update(leads)
      .set(leadPatch(lead, { id: lead.id, status: "new" }, now, today, { anyStatus: true }))
      .where(eq(leads.id, lead.id)),
  );
  const events = moved.flatMap((lead) => statusEvents(lead.id, lead.status, "new", userId, now));
  const [first, ...rest] = updates;
  if (first === undefined) return;
  await db.batch([
    first,
    ...rest,
    ...(events.length > 0 ? [db.insert(leadEvents).values(events)] : []),
  ]);
}

/**
 * "Cancelar disparo": the first e-mails that did not go out yet today are cancelled and their
 * leads stay (or go back) in "A contatar". The automatic dispatch drafts nothing more today
 * (`dispatchCancelledOn`); tomorrow it runs again. Returns how many e-mails were cancelled.
 */
export async function cancelTodaysDispatch(
  db: Db,
  now: Date,
  userId: string | null = null,
): Promise<number> {
  await writeDispatchControl(db, { dispatchCancelledOn: localDay(now) });
  const cancelled = await cancelQueuedFirstEmails(db, now);
  const leadIds = [...new Set(cancelled.map((row) => row.leadId))];
  await returnLeadsToNew(db, leadIds, userId, now);
  return cancelled.length;
}

import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { inList } from "@/db/in-list";
import { leadEvents, leads, users } from "@/db/schema";
import type { LeadAssignment } from "@/lib/schemas";
import { leadEvent } from "./lead-events";
import { MEMBER_NOT_FOUND_MESSAGE } from "./lead-deal";

/** Lead events per insert: D1 binds at most 100 values and an event row has 7 columns. */
const EVENTS_PER_INSERT = 14;

/** Refuses an assignment to someone who is not (or no longer) in the team. */
async function checkOwners(db: Db, assignments: readonly LeadAssignment[]): Promise<void> {
  const owners = [...new Set(assignments.flatMap((item) => (item.owner ? [item.owner] : [])))];
  if (owners.length === 0) return;
  const found = await db.select({ id: users.id }).from(users).where(inList(users.id, owners));
  if (found.length !== owners.length) throw new Error(MEMBER_NOT_FOUND_MESSAGE);
}

/** The update for one lead: applies only while its owner is still the expected one. */
function moveLead(db: Db, item: LeadAssignment) {
  const stillExpected = item.expected ? eq(leads.ownerId, item.expected) : isNull(leads.ownerId);
  return db
    .update(leads)
    .set({ ownerId: item.owner })
    .where(and(eq(leads.id, item.id), stillExpected))
    .returning({ id: leads.id });
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    result.push(items.slice(start, start + size));
  }
  return result;
}

/**
 * "Entregar a", "Dividir igualmente" and their "Desfazer". Each lead moves only if its owner is
 * still `expected` (someone may have taken it meanwhile); every move writes an owner event.
 * Returns the assignments that applied.
 */
export async function assignLeads(
  db: Db,
  assignments: readonly LeadAssignment[],
  userId: string | null,
  now: Date,
): Promise<LeadAssignment[]> {
  if (assignments.length === 0) return [];
  await checkOwners(db, assignments);
  const updates = assignments.map((item) => moveLead(db, item));
  const [first, ...rest] = updates;
  if (first === undefined) return [];
  const results = await db.batch([first, ...rest]);
  const moved = assignments.filter((_, index) => (results[index]?.length ?? 0) > 0);
  const events = moved.map((item) =>
    leadEvent(item.id, "owner", { from: item.expected, to: item.owner }, userId, now),
  );
  for (const rows of chunks(events, EVENTS_PER_INSERT)) {
    await db.insert(leadEvents).values(rows);
  }
  return moved;
}

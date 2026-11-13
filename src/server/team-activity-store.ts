import { and, desc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leadEvents, leads, type LeadEventKind } from "@/db/schema";
import type { DayRange } from "@/lib/period";

/** What the team feed shows; plain status changes ("Contatado") would drown the rest. */
export const ACTIVITY_KINDS: readonly LeadEventKind[] = [
  "owner",
  "stage",
  "won",
  "lost",
  "meeting",
  "proposal",
];

/** Newest events read for the feed; the page shows six and "Ver mais" the rest. */
export const ACTIVITY_LIMIT = 60;

/** What the team did within the range, newest first, with the lead's name and who did it. */
export async function teamActivity(db: Db, range: Pick<DayRange, "from" | "to">) {
  return db
    .select({
      id: leadEvents.id,
      kind: leadEvents.kind,
      fromValue: leadEvents.fromValue,
      toValue: leadEvents.toValue,
      userId: leadEvents.userId,
      leadId: leads.id,
      leadName: leads.name,
      createdAt: leadEvents.createdAt,
    })
    .from(leadEvents)
    .innerJoin(leads, eq(leads.id, leadEvents.leadId))
    .where(
      and(
        inArray(leadEvents.kind, [...ACTIVITY_KINDS]),
        isNotNull(leadEvents.userId),
        gte(leadEvents.createdAt, range.from),
        lt(leadEvents.createdAt, range.to),
      ),
    )
    .orderBy(desc(leadEvents.createdAt))
    .limit(ACTIVITY_LIMIT);
}

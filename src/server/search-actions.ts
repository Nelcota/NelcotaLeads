import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { SEARCH_CANCELLED_MESSAGE } from "./process-lead";

/**
 * Stops a search that is still collecting or analyzing. What was collected and analyzed stays;
 * leads still waiting for the queue are set aside (the consumer skips them too), and a lead
 * already in the model finishes. Google requests already made are not given back.
 */
export async function cancelSearch(db: Db, id: string) {
  const [cancelled] = await db
    .update(searches)
    .set({ status: "cancelled" })
    .where(and(eq(searches.id, id), inArray(searches.status, ["collecting", "analyzing"])))
    .returning({ id: searches.id });
  if (!cancelled) {
    const exists = await db.$count(searches, eq(searches.id, id));
    throw new Error(exists === 0 ? "Busca não encontrada" : "Esta busca já terminou.");
  }
  await db
    .update(leads)
    .set({ analysisStatus: "skipped", analysisError: SEARCH_CANCELLED_MESSAGE })
    .where(
      and(
        eq(leads.searchId, id),
        eq(leads.analysisStatus, "pending"),
        isNull(leads.analysisStartedAt),
      ),
    );
  return { ok: true as const };
}

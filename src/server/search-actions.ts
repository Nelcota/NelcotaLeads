import { and, eq, inArray, isNull } from "drizzle-orm";
import type { NewSearchInput } from "@/lib/schemas";
import { MANUAL_SEARCH_ID } from "@/lib/searches";
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

/** Niche, city and size of an earlier search, to run it again ("Tentar de novo", "Repetir"). */
export async function searchInputOf(db: Db, id: string): Promise<NewSearchInput> {
  const search = await db.query.searches.findFirst({
    where: eq(searches.id, id),
    columns: { niche: true, city: true, maxResults: true },
  });
  if (!search) throw new Error("Busca não encontrada");
  if (id === MANUAL_SEARCH_ID) throw new Error("Leads adicionados à mão não são uma busca.");
  return search;
}

/**
 * Hides a search from the Buscas list, or shows it again (the undo). Its leads stay where
 * they are; returns how many, for the toast. A running search must be cancelled first.
 */
export async function setSearchHidden(db: Db, id: string, hidden: boolean, now = new Date()) {
  const search = await db.query.searches.findFirst({
    where: eq(searches.id, id),
    columns: { status: true },
  });
  if (!search) throw new Error("Busca não encontrada");
  if (hidden && (search.status === "collecting" || search.status === "analyzing")) {
    throw new Error("Cancele a busca antes de ocultar.");
  }
  await db
    .update(searches)
    .set({ hiddenAt: hidden ? now : null })
    .where(eq(searches.id, id));
  return { leads: await db.$count(leads, eq(leads.searchId, id)) };
}

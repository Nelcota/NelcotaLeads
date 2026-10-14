import { and, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, searches, type SearchStatus } from "@/db/schema";
import type { PlacesProvider } from "@/lib/places";
import { toE164 } from "@/lib/phone";
import { searchErrorMessage } from "@/lib/provider-errors";
import type { NewSearchInput } from "@/lib/schemas";
import { enqueueLeads, type LeadJob } from "./queue";

export const ENQUEUE_FAILED_MESSAGE =
  "Não foi possível colocar o lead na fila de análise. Peça uma nova análise.";

/**
 * Creates a search, collects places and enqueues one analysis job per new lead.
 * Leads are unique by Google place_id; places seen in earlier searches are skipped.
 */
export async function runSearch(
  db: Db,
  queue: Queue<LeadJob>,
  provider: PlacesProvider,
  input: NewSearchInput,
  origin: "manual" | "autopilot" = "manual",
): Promise<{ searchId: string }> {
  const searchId = crypto.randomUUID();
  await db.insert(searches).values({ id: searchId, ...input, origin, status: "collecting" });

  try {
    const { places, requests, limitReached } = await provider.search(input);
    if (limitReached && places.length === 0) {
      throw new Error(
        "Limite diário de requisições ao Google atingido. A busca não foi feita; tente amanhã.",
      );
    }

    const inserts = places.map((place) =>
      db
        .insert(leads)
        .values({
          id: crypto.randomUUID(),
          searchId,
          placeId: place.placeId,
          name: place.name,
          address: place.address,
          city: input.city,
          phone: place.phone,
          phoneE164: toE164(place.phone),
          website: place.website,
          rating: place.rating,
          reviewCount: place.reviewCount,
          mapsUrl: place.mapsUrl,
          businessStatus: place.businessStatus,
          siteStatus: place.website ? "pending" : "none",
        })
        .onConflictDoNothing({ target: leads.placeId })
        .returning({ id: leads.id }),
    );
    const [first, ...rest] = inserts;
    const results = first !== undefined ? await db.batch([first, ...rest]) : [];
    const newLeadIds = results.flat().map((row) => row.id);

    // Enqueue before the search counts as analyzing: if the queue is unavailable the new
    // leads are marked as failed instead of waiting forever for an analysis.
    let enqueueError: string | null = null;
    try {
      await enqueueLeads(queue, newLeadIds);
    } catch (error) {
      console.error("could not enqueue the search's leads", searchId, error);
      enqueueError = ENQUEUE_FAILED_MESSAGE;
      await db
        .update(leads)
        .set({ analysisStatus: "error", analysisError: ENQUEUE_FAILED_MESSAGE })
        .where(and(inArray(leads.id, newLeadIds), eq(leads.analysisStatus, "pending")));
    }

    await db.batch([
      db
        .update(searches)
        .set({
          status: keepCancelled(
            enqueueError ? "error" : newLeadIds.length > 0 ? "analyzing" : "done",
          ),
          foundCount: newLeadIds.length,
          duplicateCount: places.length - newLeadIds.length,
          // Leave the counters alone otherwise: jobs may already be bumping them.
          ...(enqueueError ? { errorCount: newLeadIds.length } : {}),
          placesRequests: requests,
          errorMessage:
            enqueueError ??
            (limitReached
              ? `Limite diário de requisições ao Google atingido: coletadas ${places.length} de até ${input.maxResults} empresas.`
              : null),
        })
        .where(eq(searches.id, searchId)),
      // Jobs may finish before the search is marked as analyzing; complete it here then.
      db
        .update(searches)
        .set({ status: "done" })
        .where(
          and(
            eq(searches.id, searchId),
            eq(searches.status, "analyzing"),
            gte(sql`${searches.analyzedCount} + ${searches.errorCount}`, searches.foundCount),
          ),
        ),
    ]);
  } catch (error) {
    console.error("search failed", searchId, error);
    await db
      .update(searches)
      .set({ status: keepCancelled("error"), errorMessage: searchErrorMessage(error) })
      .where(eq(searches.id, searchId));
  }

  return { searchId };
}

/** The next status, unless the user cancelled the search while it was collecting. */
function keepCancelled(next: SearchStatus) {
  return sql<SearchStatus>`case when ${searches.status} = 'cancelled' then 'cancelled' else ${next} end`;
}

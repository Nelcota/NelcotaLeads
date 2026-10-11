import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, searches } from "@/db/schema";
import type { PlacesProvider } from "@/lib/places";
import { toE164 } from "@/lib/phone";
import type { NewSearchInput } from "@/lib/schemas";
import { enqueueLeads, type LeadJob } from "./queue";

/**
 * Creates a search, collects places and enqueues one analysis job per new lead.
 * Leads are unique by Google place_id; places seen in earlier searches are skipped.
 */
export async function runSearch(
  db: Db,
  queue: Queue<LeadJob>,
  provider: PlacesProvider,
  input: NewSearchInput,
): Promise<{ searchId: string }> {
  const searchId = crypto.randomUUID();
  await db.insert(searches).values({ id: searchId, ...input, status: "collecting" });

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

    await db
      .update(searches)
      .set({
        status: newLeadIds.length > 0 ? "analyzing" : "done",
        foundCount: newLeadIds.length,
        duplicateCount: places.length - newLeadIds.length,
        placesRequests: requests,
        errorMessage: limitReached
          ? `Limite diário de requisições ao Google atingido: coletadas ${places.length} de até ${input.maxResults} empresas.`
          : null,
      })
      .where(eq(searches.id, searchId));

    await enqueueLeads(queue, newLeadIds);
  } catch (error) {
    await db
      .update(searches)
      .set({
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      .where(eq(searches.id, searchId));
  }

  return { searchId };
}

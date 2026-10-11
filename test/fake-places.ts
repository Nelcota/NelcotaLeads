import type { PlacesProvider } from "@/lib/places";

/** Deterministic test double for Google Places (tests only): same query → same place ids. */
export function createFakePlaces(): PlacesProvider {
  return {
    name: "test",
    search: async ({ maxResults }) => ({
      requests: Math.ceil(maxResults / 20),
      places: Array.from({ length: maxResults }, (_, i) => ({
        placeId: `place-${i + 1}`,
        name: `Empresa ${i + 1}`,
        address: null,
        phone: i % 2 === 0 ? "(31) 99876-5432" : null,
        website: null,
        rating: 4.5,
        reviewCount: 10,
        mapsUrl: null,
        businessStatus: "OPERATIONAL",
      })),
    }),
  };
}

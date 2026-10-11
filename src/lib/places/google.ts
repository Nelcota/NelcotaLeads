import { z } from "zod";
import type { Place, PlacesProvider, PlacesSearchParams } from "./types";

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const PAGE_SIZE = 20;
const MAX_PAGES = 3;

// Minimal mask: these fields put the request in the "Text Search Enterprise" SKU.
export const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.googleMapsUri",
  "places.businessStatus",
  "nextPageToken",
].join(",");

const responseSchema = z.object({
  places: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.object({ text: z.string() }).optional(),
        formattedAddress: z.string().optional(),
        nationalPhoneNumber: z.string().optional(),
        websiteUri: z.string().optional(),
        rating: z.number().optional(),
        userRatingCount: z.number().optional(),
        googleMapsUri: z.string().optional(),
        businessStatus: z.string().optional(),
      }),
    )
    .default([]),
  nextPageToken: z.string().optional(),
});

export function buildTextQuery({ niche, city }: Pick<PlacesSearchParams, "niche" | "city">) {
  return `${niche} em ${city}`;
}

export function createGooglePlacesProvider(
  apiKey: string,
  fetchFn: typeof fetch = fetch,
): PlacesProvider {
  return {
    name: "google",
    async search(params) {
      const places: Place[] = [];
      let pageToken: string | undefined;
      let requests = 0;

      while (requests < MAX_PAGES && places.length < params.maxResults) {
        const response = await fetchFn(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify({
            textQuery: buildTextQuery(params),
            languageCode: "pt-BR",
            regionCode: "BR",
            pageSize: PAGE_SIZE,
            ...(pageToken ? { pageToken } : {}),
          }),
          signal: AbortSignal.timeout(15_000),
        });
        requests++;
        if (!response.ok) {
          const detail = (await response.text()).slice(0, 300);
          throw new Error(`Google Places respondeu ${response.status}: ${detail}`);
        }
        const page = responseSchema.parse(await response.json());
        for (const p of page.places) {
          if (p.businessStatus !== "OPERATIONAL") continue;
          places.push({
            placeId: p.id,
            name: p.displayName?.text ?? "Sem nome",
            address: p.formattedAddress ?? null,
            phone: p.nationalPhoneNumber ?? null,
            website: p.websiteUri ?? null,
            rating: p.rating ?? null,
            reviewCount: p.userRatingCount ?? null,
            mapsUrl: p.googleMapsUri ?? null,
            businessStatus: p.businessStatus,
          });
        }
        pageToken = page.nextPageToken;
        if (!pageToken) break;
      }

      return { places: places.slice(0, params.maxResults), requests };
    },
  };
}

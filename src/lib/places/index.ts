import { createGooglePlacesProvider } from "./google";
import { createMockPlacesProvider } from "./mock";
import type { PlacesProvider, ReserveRequest } from "./types";

export type { Place, PlacesProvider } from "./types";

/** Uses the real Google Places API when a key is configured, otherwise the mock. */
export function getPlacesProvider(
  apiKey: string | undefined,
  reserveRequest?: ReserveRequest,
): PlacesProvider {
  return apiKey
    ? createGooglePlacesProvider(apiKey, { reserveRequest })
    : createMockPlacesProvider();
}

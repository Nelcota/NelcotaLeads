import { createGooglePlacesProvider } from "./google";
import { createMockPlacesProvider } from "./mock";
import type { PlacesProvider } from "./types";

export type { Place, PlacesProvider } from "./types";

/** Uses the real Google Places API when a key is configured, otherwise the mock. */
export function getPlacesProvider(apiKey: string | undefined): PlacesProvider {
  return apiKey ? createGooglePlacesProvider(apiKey) : createMockPlacesProvider();
}

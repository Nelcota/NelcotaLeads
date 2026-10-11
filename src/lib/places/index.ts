import { createGooglePlacesProvider } from "./google";
import type { PlacesProvider, ReserveRequest } from "./types";

export type { Place, PlacesProvider } from "./types";

export function getPlacesProvider(
  apiKey: string | undefined,
  reserveRequest?: ReserveRequest,
): PlacesProvider {
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY não configurada.");
  return createGooglePlacesProvider(apiKey, { reserveRequest });
}

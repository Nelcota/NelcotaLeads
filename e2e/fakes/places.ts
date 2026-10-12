import type { PlacesProvider, ReserveRequest } from "../../src/lib/places/types";
import { createFakePlaces } from "../../test/fake-places";
import { takeFault } from "./faults";

export type { Place, PlacesProvider } from "../../src/lib/places/types";

/** E2E stand-in for Google Places: "Empresa 1…N", same place ids for every query. */
export function getPlacesProvider(
  _apiKey: string | undefined,
  _reserve?: ReserveRequest,
): PlacesProvider {
  const places = createFakePlaces();
  return {
    ...places,
    search: async (input) => {
      if (takeFault("places")) throw new Error("Google Places respondeu 500: falha simulada");
      return places.search(input);
    },
  };
}

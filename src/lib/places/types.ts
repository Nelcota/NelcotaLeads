export type Place = {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string | null;
  businessStatus: string | null;
};

export type PlacesSearchParams = { niche: string; city: string; maxResults: number };

export type PlacesSearchResult = {
  places: Place[];
  /** Billable Text Search requests made (one per page). */
  requests: number;
  /** True when the daily request limit stopped the search early. */
  limitReached?: boolean;
};

/** Asks permission for one more billable request; false means the daily limit was reached. */
export type ReserveRequest = () => Promise<boolean>;

export interface PlacesProvider {
  readonly name: string;
  search(params: PlacesSearchParams): Promise<PlacesSearchResult>;
}

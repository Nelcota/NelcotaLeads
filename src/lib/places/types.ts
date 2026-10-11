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
};

export interface PlacesProvider {
  readonly name: "google" | "mock";
  search(params: PlacesSearchParams): Promise<PlacesSearchResult>;
}

import { describe, expect, it, vi } from "vitest";
import { createGooglePlacesProvider, FIELD_MASK } from "./google";
import { createMockPlacesProvider } from "./mock";
import { toE164 } from "../phone";

function page(places: object[], nextPageToken?: string) {
  return new Response(JSON.stringify({ places, nextPageToken }), { status: 200 });
}

const place = (id: string, businessStatus = "OPERATIONAL") => ({
  id,
  displayName: { text: `Place ${id}` },
  businessStatus,
});

describe("google places provider", () => {
  it("paginates, sends the field mask and skips non-operational places", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(page([place("a"), place("b", "CLOSED_PERMANENTLY")], "t1"))
      .mockResolvedValueOnce(page([place("c")]));
    const provider = createGooglePlacesProvider("key", { fetchFn });

    const result = await provider.search({ niche: "dentistas", city: "BH", maxResults: 10 });

    expect(result.places.map((p) => p.placeId)).toEqual(["a", "c"]);
    expect(result.requests).toBe(2);
    const [first, second] = fetchFn.mock.calls;
    expect(new Headers(first?.[1]?.headers).get("X-Goog-FieldMask")).toBe(FIELD_MASK);
    expect(second?.[1]?.body).toContain('"pageToken":"t1"');
  });

  it("stops once maxResults is reached", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(page([place("a"), place("b")], "t"));
    const provider = createGooglePlacesProvider("key", { fetchFn });
    const result = await provider.search({ niche: "x", city: "y", maxResults: 1 });
    expect(result.places).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("stops paginating when the daily limit denies a request", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(page([place("a")], "t"));
    const reserveRequest = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const provider = createGooglePlacesProvider("key", { fetchFn, reserveRequest });
    const result = await provider.search({ niche: "x", city: "y", maxResults: 60 });
    expect(result).toMatchObject({ requests: 1, limitReached: true });
    expect(result.places).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("throws a readable error on HTTP failures", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("denied", { status: 403 }));
    await expect(
      createGooglePlacesProvider("key", { fetchFn }).search({
        niche: "x",
        city: "y",
        maxResults: 5,
      }),
    ).rejects.toThrow(/403/);
  });
});

describe("mock places provider", () => {
  it("is deterministic and produces valid phones", async () => {
    const provider = createMockPlacesProvider();
    const a = await provider.search({ niche: "Dentistas", city: "Belo Horizonte", maxResults: 12 });
    const b = await provider.search({ niche: "Dentistas", city: "Belo Horizonte", maxResults: 12 });
    expect(a.places.map((p) => p.placeId)).toEqual(b.places.map((p) => p.placeId));
    const phones = a.places.flatMap((p) => (p.phone ? [p.phone] : []));
    expect(phones.length).toBeGreaterThan(0);
    expect(phones.map(toE164)).not.toContain(null);
  });
});

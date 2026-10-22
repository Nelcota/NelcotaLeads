import { describe, expect, it, vi } from "vitest";
import { createGooglePlacesProvider, FIELD_MASK } from "./google";

function page(places: object[], nextPageToken?: string) {
  return new Response(JSON.stringify({ places, nextPageToken }), { status: 200 });
}

const place = (id: string, businessStatus = "OPERATIONAL") => ({
  id,
  displayName: { text: `Place ${id}` },
  businessStatus,
});

const rated = (id: string, rating: number, userRatingCount: number) => ({
  ...place(id),
  rating,
  userRatingCount,
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

  it("keeps ratings and counts only within their range", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        page([rated("a", 1, 0), rated("b", 5, 12), rated("c", 7.5, 2.5), rated("d", 0.9, -1)]),
      );
    const result = await createGooglePlacesProvider("key", { fetchFn }).search({
      niche: "x",
      city: "y",
      maxResults: 10,
    });
    expect(result.places.map((p) => [p.placeId, p.rating, p.reviewCount])).toEqual([
      ["a", 1, 0],
      ["b", 5, 12],
      ["c", null, null],
      ["d", null, null],
    ]);
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

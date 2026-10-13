import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test/reset-db";
import { getDb } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { createFakePlaces } from "../../test/fake-places";
import { createFakeQueue } from "../../test/fake-queue";
import type { PlacesProvider } from "@/lib/places";
import { ENQUEUE_FAILED_MESSAGE, runSearch } from "./collect";

const fakeQueue = createFakeQueue;

const input = { niche: "Dentistas", city: "Belo Horizonte", maxResults: 9 };

describe("runSearch", () => {
  beforeEach(resetDb);

  it("stores unique leads and enqueues one job per new lead", async () => {
    const db = getDb(env.DB);
    const { sent, queue } = fakeQueue();
    const provider = createFakePlaces();

    const first = await runSearch(db, queue, provider, input);
    const search = await db.query.searches.findFirst({
      where: (s, { eq }) => eq(s.id, first.searchId),
    });
    expect(search).toMatchObject({ status: "analyzing", foundCount: 9, duplicateCount: 0 });
    expect(sent).toHaveLength(9);

    // Same query again: every place already exists, nothing new is stored or enqueued.
    const second = await runSearch(db, queue, provider, { ...input, maxResults: 12 });
    const again = await db.query.searches.findFirst({
      where: (s, { eq }) => eq(s.id, second.searchId),
    });
    expect(again).toMatchObject({ status: "analyzing", foundCount: 3, duplicateCount: 9 });
    expect(await db.$count(leads)).toBe(12);
    expect(sent).toHaveLength(12);
  });

  it("keeps a search cancelled while it was collecting", async () => {
    const db = getDb(env.DB);
    const places = createFakePlaces();
    // The user cancels while Google is still answering.
    const cancelling: PlacesProvider = {
      name: "test",
      search: async (query) => {
        await db.update(searches).set({ status: "cancelled" });
        return places.search(query);
      },
    };
    const { searchId } = await runSearch(db, fakeQueue().queue, cancelling, input);
    const search = await db.query.searches.findFirst({
      where: (s, { eq }) => eq(s.id, searchId),
    });
    expect(search).toMatchObject({ status: "cancelled", foundCount: 9 });
  });

  it("fails with a clear message when the daily limit blocks the whole search", async () => {
    const limited: PlacesProvider = {
      name: "google",
      search: async () => ({ places: [], requests: 0, limitReached: true }),
    };
    const { searchId } = await runSearch(getDb(env.DB), fakeQueue().queue, limited, input);
    const search = await getDb(env.DB).query.searches.findFirst({
      where: (s, { eq }) => eq(s.id, searchId),
    });
    expect(search?.status).toBe("error");
    expect(search?.errorMessage).toMatch(/Limite diário/);
  });

  it("marks the search as failed when the provider throws", async () => {
    const db = getDb(env.DB);
    const failing: PlacesProvider = {
      name: "google",
      search: () => Promise.reject(new Error("quota exceeded")),
    };
    const { searchId } = await runSearch(db, fakeQueue().queue, failing, input);
    const search = await db.query.searches.findFirst({ where: (s, { eq }) => eq(s.id, searchId) });
    expect(search).toMatchObject({ status: "error", errorMessage: "quota exceeded" });
  });

  it("marks the new leads as failed when they cannot be enqueued", async () => {
    const db = getDb(env.DB);
    const { queue } = fakeQueue();
    queue.sendBatch = () => Promise.reject(new Error("queue down"));
    const { searchId } = await runSearch(db, queue, createFakePlaces(), input);
    const search = await db.query.searches.findFirst({ where: (s, { eq }) => eq(s.id, searchId) });
    expect(search).toMatchObject({
      status: "error",
      foundCount: 9,
      errorCount: 9,
      errorMessage: ENQUEUE_FAILED_MESSAGE,
    });
    const rows = await db.select().from(leads);
    expect(rows).toHaveLength(9);
    expect(rows.every((lead) => lead.analysisStatus === "error")).toBe(true);
  });
});

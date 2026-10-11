import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test/reset-db";
import { getDb } from "@/db/client";
import { leads } from "@/db/schema";
import { createFakePlaces } from "../../test/fake-places";
import type { PlacesProvider } from "@/lib/places";
import { runSearch } from "./collect";
import type { LeadJob } from "./queue";

function fakeQueue() {
  const sent: LeadJob[] = [];
  const queue = {
    sendBatch: async (messages: Iterable<MessageSendRequest<LeadJob>>) => {
      for (const message of messages) sent.push(message.body);
      return { metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } } };
    },
  };
  // Only sendBatch is used by the code under test.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { sent, queue: queue as Partial<Queue<LeadJob>> as Queue<LeadJob> };
}

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
});

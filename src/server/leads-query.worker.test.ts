import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { countLeads } from "./leads-query";

const db = getDb(env.DB);

describe("countLeads", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 5 });
    const base = { searchId: "s", siteStatus: "none" as const };
    await db.insert(leads).values([
      {
        ...base,
        id: "1",
        placeId: "1",
        name: "A",
        score: 80,
        status: "new",
        analysisStatus: "done",
      },
      {
        ...base,
        id: "2",
        placeId: "2",
        name: "B",
        score: 45,
        status: "contacted",
        analysisStatus: "done",
      },
      {
        ...base,
        id: "3",
        placeId: "3",
        name: "C",
        score: 10,
        status: "new",
        analysisStatus: "done",
      },
      { ...base, id: "4", placeId: "4", name: "D", score: null, status: "new" },
    ]);
  });

  it("counts by status and score band", async () => {
    expect(await countLeads(db, {})).toEqual({
      total: 4,
      byStatus: { new: 3, contacted: 1, replied: 0, closed: 0, discarded: 0 },
      byTier: { high: 1, medium: 1, low: 1 },
      pending: 1,
    });
  });

  it("status counts ignore the status filter; band counts ignore the score range", async () => {
    const counts = await countLeads(db, { status: "new", minScore: 60 });
    expect(counts.byStatus).toMatchObject({ new: 1, contacted: 0 });
    expect(counts.byTier).toEqual({ high: 1, medium: 0, low: 1 });
  });
});

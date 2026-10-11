import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { countLeads, queryLeads } from "./leads-query";

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
        followUpOn: "2026-10-10",
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

  it("counts each queue and score band", async () => {
    expect(await countLeads(db, {}, "2026-10-11")).toEqual({
      byView: {
        todo: 3,
        followup: 1,
        waiting: 1,
        talking: 0,
        closed: 0,
        discarded: 0,
        all: 4,
      },
      byTier: { high: 1, medium: 1, low: 1 },
      pending: 1,
    });
  });

  it("follow-up queue only includes leads due today or earlier", async () => {
    expect((await countLeads(db, {}, "2026-10-09")).byView.followup).toBe(0);
    const due = await queryLeads(db, { view: "followup" }, "2026-10-10");
    expect(due.map((lead) => lead.id)).toEqual(["2"]);
  });

  it("queue counts ignore the view filter; band counts ignore the score range", async () => {
    const counts = await countLeads(db, { view: "todo", minScore: 60 }, "2026-10-11");
    expect(counts.byView).toMatchObject({ todo: 1, waiting: 0 });
    expect(counts.byTier).toEqual({ high: 1, medium: 0, low: 1 });
  });
});

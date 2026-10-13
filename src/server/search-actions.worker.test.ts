import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import { resetDb } from "../../test/reset-db";
import { processLead, SEARCH_CANCELLED_MESSAGE, type ProcessDeps } from "./process-lead";
import { cancelSearch } from "./search-actions";

const db = getDb(env.DB);

const deps: ProcessDeps = {
  db,
  analyzer: createFakeAnalyzer(80),
  fetchSite: async () => ({ status: "unreachable", reason: "x" }),
};

async function lead(id: string) {
  return db.query.leads.findFirst({ where: eq(leads.id, id) });
}

async function search(id = "s") {
  return db.query.searches.findFirst({ where: eq(searches.id, id) });
}

describe("cancelSearch", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({
      id: "s",
      niche: "x",
      city: "y",
      maxResults: 3,
      status: "analyzing",
      foundCount: 3,
      analyzedCount: 1,
    });
    await db.insert(leads).values([
      { id: "done", searchId: "s", placeId: "p1", name: "A", analysisStatus: "done", score: 70 },
      { id: "waiting", searchId: "s", placeId: "p2", name: "B", siteStatus: "none" },
      {
        id: "busy",
        searchId: "s",
        placeId: "p3",
        name: "C",
        siteStatus: "none",
        analysisStartedAt: new Date(),
      },
    ]);
  });

  it("stops a running search and sets aside the leads still waiting", async () => {
    await cancelSearch(db, "s");
    expect(await search()).toMatchObject({ status: "cancelled", analyzedCount: 1 });
    expect(await lead("done")).toMatchObject({ analysisStatus: "done", score: 70 });
    expect(await lead("waiting")).toMatchObject({
      analysisStatus: "skipped",
      analysisError: SEARCH_CANCELLED_MESSAGE,
    });
    // The one already in the model is left to finish.
    expect(await lead("busy")).toMatchObject({ analysisStatus: "pending" });
  });

  it("refuses a search that already ended, or an unknown one", async () => {
    await db.update(searches).set({ status: "done" }).where(eq(searches.id, "s"));
    await expect(cancelSearch(db, "s")).rejects.toThrow("já terminou");
    await expect(cancelSearch(db, "nope")).rejects.toThrow("Busca não encontrada");
  });

  it("makes the consumer skip queued leads of the cancelled search", async () => {
    await db.update(searches).set({ status: "cancelled" }).where(eq(searches.id, "s"));
    expect(await processLead(deps, { leadId: "waiting" })).toBe("skipped");
    expect(await lead("waiting")).toMatchObject({ analysisStatus: "skipped", score: null });
    // Delivered again (or after cancelSearch already set it aside): still nothing to do.
    expect(await processLead(deps, { leadId: "waiting" })).toBe("skipped");
    expect(await search()).toMatchObject({ status: "cancelled", analyzedCount: 1 });
  });

  it("still analyzes a lead of a cancelled search when asked explicitly", async () => {
    await cancelSearch(db, "s");
    expect(await processLead(deps, { leadId: "waiting", force: true })).toBe("done");
    expect(await lead("waiting")).toMatchObject({ analysisStatus: "done", score: 80 });
    expect(await search()).toMatchObject({ status: "cancelled" });
  });
});

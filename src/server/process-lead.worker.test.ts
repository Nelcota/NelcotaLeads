import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "../../test/reset-db";
import { getDb } from "@/db/client";
import { analyses, leads, searches } from "@/db/schema";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import type { SiteResult } from "@/lib/scrape";
import { failLead, processLead, writeMessageForLead, type ProcessDeps } from "./process-lead";

const db = getDb(env.DB);
const SEARCH = "search-1";

async function seed() {
  await db.insert(searches).values({
    id: SEARCH,
    niche: "Dentistas",
    city: "BH",
    maxResults: 2,
    status: "analyzing",
    foundCount: 2,
  });
  await db.insert(leads).values([
    {
      id: "a",
      searchId: SEARCH,
      placeId: "p-a",
      name: "A",
      phone: "(31) 99876-5432",
      website: "https://a.com.br",
      siteStatus: "pending",
    },
    { id: "b", searchId: SEARCH, placeId: "p-b", name: "B", siteStatus: "none" },
  ]);
}

function deps(overrides: Partial<ProcessDeps> = {}): ProcessDeps {
  const fetchSite = vi.fn<(url: string) => Promise<SiteResult>>().mockResolvedValue({
    status: "unreachable",
    reason: "timeout",
  });
  return { db, analyzer: createFakeAnalyzer(), fetchSite, ...overrides };
}

const getSearch = () => db.query.searches.findFirst({ where: eq(searches.id, SEARCH) });

describe("processLead", () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
  });

  it("analyzes leads, records cost data and completes the search", async () => {
    const d = deps();
    await processLead(d, { leadId: "a" });
    expect(await getSearch()).toMatchObject({ analyzedCount: 1, status: "analyzing" });

    await processLead(d, { leadId: "b" });
    expect(await getSearch()).toMatchObject({ analyzedCount: 2, status: "done" });

    const leadA = await db.query.leads.findFirst({ where: eq(leads.id, "a") });
    expect(leadA).toMatchObject({ analysisStatus: "done", siteStatus: "unreachable" });
    expect(leadA?.score).toBeTypeOf("number");
    const analysis = await db.query.analyses.findFirst({ where: eq(analyses.leadId, "a") });
    expect(analysis).toMatchObject({ model: "test-model", tokensIn: 100, costEstimate: 0.0001 });
    expect(d.fetchSite).toHaveBeenCalledTimes(1); // lead "b" has no site
  });

  it("is idempotent unless forced", async () => {
    const d = deps();
    await processLead(d, { leadId: "a" });
    expect(await processLead(d, { leadId: "a" })).toBe("skipped");
    expect(await processLead(d, { leadId: "a", force: true })).toBe("done");
    expect(await db.$count(analyses, eq(analyses.leadId, "a"))).toBe(2);
    // Forced re-analysis must not inflate the search counters.
    expect(await getSearch()).toMatchObject({ analyzedCount: 1 });
  });

  it("propagates analyzer errors so the queue can retry, then records the failure", async () => {
    const analyzer = createFakeAnalyzer();
    analyzer.analyze = () => Promise.reject(new Error("rate limited"));
    await expect(processLead(deps({ analyzer }), { leadId: "a" })).rejects.toThrow("rate limited");

    await failLead(db, { leadId: "a" }, new Error("rate limited"));
    await failLead(db, { leadId: "a" }, new Error("rate limited")); // duplicate delivery
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "a") })).toMatchObject({
      analysisStatus: "error",
      analysisError: "rate limited",
    });
    expect(await getSearch()).toMatchObject({ errorCount: 1, status: "analyzing" });

    await processLead(deps(), { leadId: "b" });
    expect(await getSearch()).toMatchObject({ analyzedCount: 1, errorCount: 1, status: "done" });
  });

  it("only writes a first message above the configured threshold", async () => {
    await processLead(deps(), { leadId: "b" }); // fake score 40 < default threshold 60
    const low = await db.query.analyses.findFirst({ where: eq(analyses.leadId, "b") });
    expect(low?.firstMessage).toBeNull();

    await processLead(deps({ analyzer: createFakeAnalyzer(80) }), { leadId: "a" });
    const high = await db.query.analyses.findFirst({ where: eq(analyses.leadId, "a") });
    expect(high).toMatchObject({ firstMessage: "Olá, A", tokensIn: 200, costEstimate: 0.0002 });
  });

  it("writes a message on demand and adds its usage to the analysis", async () => {
    await expect(writeMessageForLead(deps(), "b")).rejects.toThrow("ainda não foi analisado");
    await processLead(deps(), { leadId: "b" }); // below threshold → no message
    expect(await writeMessageForLead(deps(), "b")).toBe("Olá, B");
    const analysis = await db.query.analyses.findFirst({ where: eq(analyses.leadId, "b") });
    expect(analysis).toMatchObject({ firstMessage: "Olá, B", tokensIn: 200, model: "test-model" });
  });
});

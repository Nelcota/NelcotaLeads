import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "../../test/reset-db";
import { getDb } from "@/db/client";
import { analyses, apiUsage, leads, searches } from "@/db/schema";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import type { SiteResult } from "@/lib/scrape";
import type { SiteData } from "@/lib/schemas";
import {
  CLAIM_TIMEOUT_MS,
  failLead,
  LEAD_BUSY_MESSAGE,
  processLead,
  writeMessageForLead,
  type ProcessDeps,
} from "./process-lead";
import { DEFAULT_SETTINGS, storeSettings } from "./settings-store";

const db = getDb(env.DB);
const SEARCH = "search-1";

async function seed() {
  await storeSettings(db, { ...DEFAULT_SETTINGS, offer: "Sites para clínicas" });
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
    const usage = await db.query.apiUsage.findFirst({ where: eq(apiUsage.provider, "deepseek") });
    expect(usage).toMatchObject({ requests: 2 });
    expect(usage?.costUsd).toBeCloseTo(0.0002);
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

  it("keeps leads that pass triage without writing anything yet", async () => {
    await processLead(deps(), { leadId: "a" }); // fake score 40 >= default minimum 30
    const kept = await db.query.analyses.findFirst({ where: eq(analyses.leadId, "a") });
    expect(kept?.firstMessage).toBeNull();
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "a") })).toMatchObject({
      status: "new",
      discardReason: null,
    });
  });

  it("writes no message while the offer is not described", async () => {
    await storeSettings(db, DEFAULT_SETTINGS);
    await processLead(deps(), { leadId: "a" });
    const analysis = await db.query.analyses.findFirst({ where: eq(analyses.leadId, "a") });
    expect(analysis?.firstMessage).toBeNull();
    await expect(writeMessageForLead(deps(), "a")).rejects.toThrow("Descreva o que você vende");
  });

  it("discards leads below the minimum score and restores them if a new analysis passes", async () => {
    await processLead(deps({ analyzer: createFakeAnalyzer(10) }), { leadId: "b" });
    const low = await db.query.analyses.findFirst({ where: eq(analyses.leadId, "b") });
    expect(low?.firstMessage).toBeNull();
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "b") })).toMatchObject({
      status: "discarded",
      discardReason: "Nota 10, abaixo do mínimo de 30",
    });

    await processLead(deps({ analyzer: createFakeAnalyzer(70) }), { leadId: "b", force: true });
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "b") })).toMatchObject({
      status: "new",
      discardReason: null,
    });
  });

  it("never discards a lead that was already contacted", async () => {
    await db.update(leads).set({ status: "contacted" }).where(eq(leads.id, "b"));
    await processLead(deps({ analyzer: createFakeAnalyzer(5) }), { leadId: "b" });
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "b") })).toMatchObject({
      status: "contacted",
    });
  });

  it("writes a message on demand and adds its usage to the analysis", async () => {
    await expect(writeMessageForLead(deps(), "b")).rejects.toThrow("ainda não foi analisado");
    await processLead(deps({ analyzer: createFakeAnalyzer(10) }), { leadId: "b" }); // discarded → no message
    expect(await writeMessageForLead(deps(), "b")).toBe("Olá, B");
    const analysis = await db.query.analyses.findFirst({ where: eq(analyses.leadId, "b") });
    expect(analysis).toMatchObject({ firstMessage: "Olá, B", tokensIn: 200, model: "test-model" });
  });

  it("analyzes and pays for a lead once when two deliveries run at the same time", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fake = createFakeAnalyzer();
    const analyzer = createFakeAnalyzer();
    analyzer.analyze = async (...args) => {
      await gate;
      return fake.analyze(...args);
    };
    const first = processLead(deps({ analyzer }), { leadId: "b" });
    await vi.waitFor(async () => {
      const lead = await db.query.leads.findFirst({ where: eq(leads.id, "b") });
      expect(lead?.analysisStartedAt).not.toBeNull();
    });
    // The duplicate is retried by the queue instead of calling the model again.
    await expect(processLead(deps({ analyzer }), { leadId: "b" })).rejects.toThrow(
      LEAD_BUSY_MESSAGE,
    );
    release();
    expect(await first).toBe("done");
    expect(await processLead(deps({ analyzer }), { leadId: "b" })).toBe("skipped");

    expect(await db.$count(analyses, eq(analyses.leadId, "b"))).toBe(1);
    const usage = await db.query.apiUsage.findFirst({ where: eq(apiUsage.provider, "deepseek") });
    expect(usage).toMatchObject({ requests: 1 });
    expect(await getSearch()).toMatchObject({ analyzedCount: 1 });
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "b") })).toMatchObject({
      analysisStatus: "done",
      analysisStartedAt: null,
    });
  });

  it("takes over a claim abandoned for too long", async () => {
    await db
      .update(leads)
      .set({ analysisStartedAt: new Date(Date.now() - CLAIM_TIMEOUT_MS - 60_000) })
      .where(eq(leads.id, "b"));
    expect(await processLead(deps(), { leadId: "b" })).toBe("done");
  });

  it("releases the claim when the analysis fails, so the retry can run", async () => {
    const analyzer = createFakeAnalyzer();
    analyzer.analyze = () => Promise.reject(new Error("rate limited"));
    await expect(processLead(deps({ analyzer }), { leadId: "b" })).rejects.toThrow("rate limited");
    expect(
      (await db.query.leads.findFirst({ where: eq(leads.id, "b") }))?.analysisStartedAt,
    ).toBeNull();
    expect(await processLead(deps(), { leadId: "b" })).toBe("done");
    expect(await getSearch()).toMatchObject({ analyzedCount: 1, errorCount: 0 });
  });

  it("never revives leads discarded for reasons other than their score", async () => {
    await db
      .update(leads)
      .set({ status: "discarded", discardReason: "Teste: close" })
      .where(eq(leads.id, "a"));
    await db
      .update(leads)
      .set({
        status: "discarded",
        discardReason: "Nota 10, abaixo do mínimo de 30",
        unsubscribedAt: new Date(),
      })
      .where(eq(leads.id, "b"));
    const high = deps({ analyzer: createFakeAnalyzer(90) });
    await processLead(high, { leadId: "a", force: true });
    await processLead(high, { leadId: "b", force: true });
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "a") })).toMatchObject({
      status: "discarded",
      discardReason: "Teste: close",
    });
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "b") })).toMatchObject({
      status: "discarded",
    });
  });

  it("does not store scraped site data with an unexpected shape", async () => {
    const fetchSite = vi.fn<(url: string) => Promise<SiteResult>>().mockResolvedValue({
      status: "ok",
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- malformed on purpose
      data: { finalUrl: "https://a.com.br", emails: "not-a-list" } as unknown as SiteData,
      text: "Clínica",
    });
    await processLead(deps({ fetchSite }), { leadId: "a" });
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "a") })).toMatchObject({
      siteStatus: "ok",
      siteData: null,
      siteTextExcerpt: "Clínica",
      analysisStatus: "done",
    });
  });
});

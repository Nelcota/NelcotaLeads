import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { createMockAnalyzer } from "@/lib/ai/mock";
import { resetDb } from "../../test/reset-db";
import { DEAD_LETTER_QUEUE, handleLeadBatch, retryDelaySeconds } from "./consumer";
import type { ProcessDeps } from "./process-lead";
import type { LeadJob } from "./queue";

const db = getDb(env.DB);

function message(leadId: string, attempts: number) {
  return {
    id: leadId,
    timestamp: new Date(),
    attempts,
    body: { leadId },
    ack: vi.fn<() => void>(),
    retry: vi.fn<(options?: QueueRetryOptions) => void>(),
  };
}

function batch(queue: string, messages: ReturnType<typeof message>[]) {
  // Only queue, messages, ack and retry are used by the consumer.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return {
    queue,
    messages,
    ackAll: vi.fn<() => void>(),
    retryAll: vi.fn<() => void>(),
  } as unknown as MessageBatch<LeadJob>;
}

function failingDeps(): ProcessDeps {
  const analyzer = createMockAnalyzer();
  analyzer.analyze = () => Promise.reject(new Error("upstream 503"));
  return { db, analyzer, fetchSite: async () => ({ status: "unreachable", reason: "x" }) };
}

describe("handleLeadBatch", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({
      id: "s",
      niche: "x",
      city: "y",
      maxResults: 2,
      status: "analyzing",
      foundCount: 2,
    });
    await db.insert(leads).values([
      { id: "a", searchId: "s", placeId: "pa", name: "A", siteStatus: "none" },
      { id: "b", searchId: "s", placeId: "pb", name: "B", siteStatus: "none" },
    ]);
  });

  it("acks successes and retries failures with backoff", async () => {
    const ok = message("a", 1);
    await handleLeadBatch(batch("main", [ok]), {
      ...failingDeps(),
      analyzer: createMockAnalyzer(),
    });
    expect(ok.ack).toHaveBeenCalled();

    const failing = message("b", 1);
    await handleLeadBatch(batch("main", [failing]), failingDeps());
    expect(failing.retry).toHaveBeenCalledWith({ delaySeconds: 30 });
    expect(failing.ack).not.toHaveBeenCalled();
  });

  it("records the error and finishes the search on the last attempt", async () => {
    await handleLeadBatch(batch("main", [message("a", 1)]), {
      ...failingDeps(),
      analyzer: createMockAnalyzer(),
    });
    const last = message("b", 3);
    await handleLeadBatch(batch("main", [last]), failingDeps());
    expect(last.ack).toHaveBeenCalled();
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "b") })).toMatchObject({
      analysisStatus: "error",
      analysisError: "upstream 503",
    });
    expect(await db.query.searches.findFirst({ where: eq(searches.id, "s") })).toMatchObject({
      status: "done",
      analyzedCount: 1,
      errorCount: 1,
    });
  });

  it("marks dead-lettered leads as failed", async () => {
    const dead = message("a", 6);
    await handleLeadBatch(batch(DEAD_LETTER_QUEUE, [dead]), failingDeps());
    expect(dead.ack).toHaveBeenCalled();
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "a") })).toMatchObject({
      analysisStatus: "error",
    });
  });
});

describe("retryDelaySeconds", () => {
  it("doubles each attempt", () => {
    expect([1, 2, 3].map(retryDelaySeconds)).toEqual([30, 60, 120]);
  });
});

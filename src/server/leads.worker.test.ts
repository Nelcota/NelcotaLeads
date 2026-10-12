import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { createFakeQueue } from "../../test/fake-queue";
import { resetDb } from "../../test/reset-db";
import { requestReanalysis } from "./leads";

const db = getDb(env.DB);

describe("requestReanalysis", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
    await db.insert(leads).values({
      id: "a",
      searchId: "s",
      placeId: "pa",
      name: "A",
      analysisStatus: "done",
    });
  });

  it("queues one forced analysis, however many times it is asked", async () => {
    const { sent, queue } = createFakeQueue();
    expect(await requestReanalysis(db, queue, "a")).toMatchObject({ queued: true });
    expect(await requestReanalysis(db, queue, "a")).toMatchObject({ queued: false });
    expect(sent).toEqual([{ leadId: "a", force: true }]);
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "a") })).toMatchObject({
      analysisStatus: "pending",
    });
  });

  it("marks the lead as failed when the queue is unavailable", async () => {
    const { queue } = createFakeQueue();
    queue.sendBatch = () => Promise.reject(new Error("queue down"));
    await expect(requestReanalysis(db, queue, "a")).rejects.toThrow("nova análise");
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "a") })).toMatchObject({
      analysisStatus: "error",
    });
    // The failure frees it for another try.
    expect(await requestReanalysis(db, createFakeQueue().queue, "a")).toMatchObject({
      queued: true,
    });
  });

  it("rejects unknown leads", async () => {
    await expect(requestReanalysis(db, createFakeQueue().queue, "zz")).rejects.toThrow(
      "Lead não encontrado",
    );
  });
});

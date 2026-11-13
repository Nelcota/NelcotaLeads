import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { apiUsage, leads, searches } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { loadSettingsOverview, UNSUBSCRIBED_SHOWN } from "./settings-overview";
import { DEEPSEEK } from "./usage";

const db = getDb(env.DB);
// 2026-11-13 15:00 in Brazil.
const now = new Date("2026-11-13T18:00:00Z");

describe("loadSettingsOverview", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
  });

  it("counts analyzed leads per score and skips unscored ones", async () => {
    await db.insert(leads).values([
      { id: "a", searchId: "s", placeId: "p1", name: "A", score: 3 },
      { id: "b", searchId: "s", placeId: "p2", name: "B", score: 34 },
      { id: "c", searchId: "s", placeId: "p3", name: "C", score: 30 },
      { id: "d", searchId: "s", placeId: "p4", name: "D", score: 100 },
      { id: "e", searchId: "s", placeId: "p5", name: "E" },
    ]);
    const { scoreCounts } = await loadSettingsOverview(db, now);
    expect(scoreCounts.toSorted((x, y) => x.score - y.score)).toEqual([
      { score: 3, leads: 1 },
      { score: 30, leads: 1 },
      { score: 34, leads: 1 },
      { score: 100, leads: 1 },
    ]);
  });

  it("sums only this month's AI spend", async () => {
    await db.insert(apiUsage).values([
      { day: "2026-11-01", provider: DEEPSEEK, requests: 3, costUsd: 0.5 },
      { day: "2026-11-13", provider: DEEPSEEK, requests: 2, costUsd: 0.25 },
      { day: "2026-10-31", provider: DEEPSEEK, requests: 9, costUsd: 4 },
    ]);
    expect((await loadSettingsOverview(db, now)).aiMonthUsd).toBeCloseTo(0.75);
  });

  it("lists the latest unsubscribed leads, newest first, and counts them all", async () => {
    const rows = Array.from({ length: UNSUBSCRIBED_SHOWN + 2 }, (_, i) => ({
      id: `u${i}`,
      searchId: "s",
      placeId: `pu${i}`,
      name: `Empresa ${i}`,
      email: `contato${i}@empresa.test`,
      unsubscribedAt: new Date(now.getTime() - i * 86_400_000),
    }));
    await db.insert(leads).values(rows);
    const { unsubscribed } = await loadSettingsOverview(db, now);
    expect(unsubscribed.total).toBe(UNSUBSCRIBED_SHOWN + 2);
    expect(unsubscribed.latest.map((row) => row.id)).toEqual(["u0", "u1", "u2", "u3", "u4"]);
  });
});

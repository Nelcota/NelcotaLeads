import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { leads, monthlyGoals, searches } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { goalForMonth, monthlyGoalStatus, storeGoal } from "./goal-store";

const db = getDb(env.DB);
const now = new Date("2026-11-03T17:00:00Z");

describe("monthly goal", () => {
  beforeEach(resetDb);

  it("is null until a goal is set", async () => {
    expect(await goalForMonth(db, "2026-11")).toBeNull();
  });

  it("saves the current month and keeps past months' goals", async () => {
    await db.insert(monthlyGoals).values({ month: "2026-09", deals: 5, revenueCents: 500_000 });
    await storeGoal(db, "2026-11", { deals: 10, revenueCents: 1_500_000 }, now);
    await storeGoal(db, "2026-11", { deals: 12, revenueCents: 1_800_000 }, now);
    expect(await goalForMonth(db, "2026-11")).toEqual({
      month: "2026-11",
      deals: 12,
      revenueCents: 1_800_000,
    });
    expect(await goalForMonth(db, "2026-09")).toMatchObject({ deals: 5 });
    expect(await db.select().from(monthlyGoals)).toHaveLength(2);
  });

  it("falls back to the latest earlier month's goal, never a later one", async () => {
    await db.insert(monthlyGoals).values([
      { month: "2026-08", deals: 4, revenueCents: 400_000 },
      { month: "2026-10", deals: 6, revenueCents: 600_000 },
      { month: "2026-12", deals: 9, revenueCents: 900_000 },
    ]);
    expect(await goalForMonth(db, "2026-11")).toMatchObject({ month: "2026-10", deals: 6 });
    expect(await goalForMonth(db, "2026-09")).toMatchObject({ month: "2026-08" });
    expect(await goalForMonth(db, "2026-07")).toBeNull();
  });

  it("counts deals won inside the month in Brazil time, with their value", async () => {
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
    const base = { searchId: "s", status: "closed" as const };
    await db.insert(leads).values([
      // 01/11 00:30 in Brazil: this month.
      {
        ...base,
        id: "a",
        placeId: "a",
        name: "A",
        closedAt: new Date("2026-11-01T03:30:00Z"),
        dealValueCents: 100_000,
      },
      { ...base, id: "b", placeId: "b", name: "B", closedAt: now, dealValueCents: 250_000 },
      // 31/10 23:30 in Brazil: last month.
      {
        ...base,
        id: "c",
        placeId: "c",
        name: "C",
        closedAt: new Date("2026-11-01T02:30:00Z"),
        dealValueCents: 999_000,
      },
      // Reopened after closing: no longer a deal.
      {
        ...base,
        id: "d",
        placeId: "d",
        name: "D",
        status: "replied",
        closedAt: now,
        dealValueCents: 50_000,
      },
    ]);
    const status = await monthlyGoalStatus(db, "2026-11");
    expect(status.progress).toEqual({ deals: 2, revenueCents: 350_000 });
  });
});

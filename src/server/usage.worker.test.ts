import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { resetDb } from "../../test/reset-db";
import { placesDailyLimit, requestsToday, reserveRequest } from "./usage";

const db = getDb(env.DB);
// 02:00 UTC on the 12th is still the 11th in Brazil (UTC-3).
const lateNight = new Date("2026-10-12T02:00:00Z");
const nextMorning = new Date("2026-10-12T12:00:00Z");

describe("daily request limit", () => {
  beforeEach(resetDb);

  it("allows exactly `limit` requests per day", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await reserveRequest(db, "g", 3, lateNight));
    expect(results).toEqual([true, true, true, false]);
    expect(await requestsToday(db, "g", lateNight)).toBe(3);
  });

  it("resets on the next day in Brazil time", async () => {
    for (let i = 0; i < 2; i++) await reserveRequest(db, "g", 2, lateNight);
    expect(await reserveRequest(db, "g", 2, lateNight)).toBe(false);
    expect(await reserveRequest(db, "g", 2, nextMorning)).toBe(true);
  });

  it("blocks everything when the limit is 0", async () => {
    expect(await reserveRequest(db, "g", 0, lateNight)).toBe(false);
  });
});

describe("placesDailyLimit", () => {
  it("parses the env var and falls back to 50", () => {
    expect(placesDailyLimit("10")).toBe(10);
    expect(placesDailyLimit("0")).toBe(0);
    expect(placesDailyLimit(undefined)).toBe(50);
    expect(placesDailyLimit("abc")).toBe(50);
    expect(placesDailyLimit("-1")).toBe(50);
  });
});

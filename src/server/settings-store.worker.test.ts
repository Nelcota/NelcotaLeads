import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "../../test/reset-db";
import { getDb } from "@/db/client";
import {
  claimAutopilotDay,
  DEFAULT_AUTOPILOT,
  DEFAULT_SETTINGS,
  loadAutopilot,
  loadSettings,
  storeSettings,
} from "./settings-store";

describe("settings store", () => {
  beforeEach(resetDb);

  it("returns defaults before anything is saved", async () => {
    expect(await loadSettings(getDb(env.DB))).toEqual(DEFAULT_SETTINGS);
  });

  it("saves and reads back settings", async () => {
    const db = getDb(env.DB);
    const input = {
      ...DEFAULT_SETTINGS,
      offer: "Sites e automação para clínicas",
      tone: "direto" as const,
      criteria: [{ label: "Sem site", weight: 30 }],
    };
    await storeSettings(db, input);
    await storeSettings(db, { ...input, senderName: "Haniel" });
    expect(await loadSettings(db)).toEqual({ ...input, senderName: "Haniel" });
  });

  it("falls back field by field when the stored row is corrupted", async () => {
    const db = getDb(env.DB);
    await storeSettings(db, { ...DEFAULT_SETTINGS, offer: "Sites", minScore: 50 });
    await env.DB.prepare(
      `UPDATE settings SET criteria = '{"oops":1}', tone = 'gritando',
        autopilot_hour = 99, autopilot_results = 33,
        autopilot_targets = '[{"niche":"Dentistas","city":"BH"},{"city":"SP"},{"niche":"Bares","city":"Rio","areas":["Lapa"],"cursor":2}]'
       WHERE id = 1`,
    ).run();
    expect(await loadSettings(db)).toEqual({
      ...DEFAULT_SETTINGS,
      offer: "Sites",
      minScore: 50,
    });
    expect(await loadAutopilot(db)).toEqual({
      ...DEFAULT_AUTOPILOT,
      targets: [
        { niche: "Dentistas", city: "BH", areas: [], cursor: 0 },
        { niche: "Bares", city: "Rio", areas: ["Lapa"], cursor: 2 },
      ],
    });
  });

  it("survives a JSON column that does not even parse", async () => {
    const db = getDb(env.DB);
    await storeSettings(db, DEFAULT_SETTINGS);
    await env.DB.prepare(
      "UPDATE settings SET criteria = 'not json', autopilot_targets = '[' WHERE id = 1",
    ).run();
    expect((await loadSettings(db)).criteria).toEqual(DEFAULT_SETTINGS.criteria);
    expect((await loadAutopilot(db)).targets).toEqual([]);
  });

  it("claims each day's autopilot run once", async () => {
    const db = getDb(env.DB);
    await storeSettings(db, DEFAULT_SETTINGS);
    expect(await claimAutopilotDay(db, "2026-10-11")).toBe(true);
    expect(await claimAutopilotDay(db, "2026-10-11")).toBe(false);
    expect(await claimAutopilotDay(db, "2026-10-12")).toBe(true);
  });
});

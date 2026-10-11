import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { DEFAULT_SETTINGS, loadSettings, storeSettings } from "./settings-store";

describe("settings store", () => {
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
});

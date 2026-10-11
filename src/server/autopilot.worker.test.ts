import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { analyses, leads, searches } from "@/db/schema";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import { createFakePlaces } from "../../test/fake-places";
import { createFakeQueue } from "../../test/fake-queue";
import { resetDb } from "../../test/reset-db";
import { nextQuery, runAutopilot, type AutopilotDeps } from "./autopilot";
import { draftFollowUps } from "./follow-ups";
import {
  DEFAULT_SETTINGS,
  loadAutopilot,
  storeAutopilot,
  storeSettings,
  writeAutopilot,
} from "./settings-store";

const db = getDb(env.DB);
const target = { niche: "Dentistas", city: "Belo Horizonte", areas: [], cursor: 0 };

function deps(): AutopilotDeps {
  return {
    db,
    queue: createFakeQueue().queue,
    places: createFakePlaces(),
    analyzer: createFakeAnalyzer(),
  };
}

// 2026-10-11 09:30 in Brazil (UTC-3).
const nineThirty = new Date("2026-10-11T12:30:00Z");
const sevenThirty = new Date("2026-10-11T10:30:00Z");

describe("nextQuery", () => {
  beforeEach(resetDb);

  it("searches the whole city first, then walks its neighborhoods", async () => {
    const first = await nextQuery(deps(), target);
    expect(first.city).toBe("Belo Horizonte");
    const second = await nextQuery(deps(), first.next);
    expect(second.city).toBe("Centro, Belo Horizonte");
    const third = await nextQuery(deps(), second.next);
    expect(third.city).toBe("Savassi, Belo Horizonte");
    expect((await nextQuery(deps(), third.next)).city).toBe("Centro, Belo Horizonte");
  });
});

describe("runAutopilot", () => {
  beforeEach(async () => {
    await resetDb();
    await storeAutopilot(db, {
      enabled: true,
      hour: 8,
      results: 20,
      targets: [{ niche: "Dentistas", city: "Belo Horizonte" }],
    });
  });

  it("searches once a day from the configured hour on", async () => {
    expect((await runAutopilot(deps(), sevenThirty)).searches).toBe(0);
    expect((await runAutopilot(deps(), nineThirty)).searches).toBe(1);
    expect((await runAutopilot(deps(), nineThirty)).searches).toBe(0);

    const rows = await db.select().from(searches);
    expect(rows).toMatchObject([{ origin: "autopilot", city: "Belo Horizonte", foundCount: 20 }]);
    expect(await loadAutopilot(db)).toMatchObject({
      lastRunOn: "2026-10-11",
      targets: [{ cursor: 1 }],
    });
  });

  it("does nothing while switched off unless forced", async () => {
    await writeAutopilot(db, { autopilotEnabled: false });
    expect((await runAutopilot(deps(), nineThirty)).searches).toBe(0);
    expect((await runAutopilot(deps(), nineThirty, { force: true })).searches).toBe(1);
  });
});

describe("draftFollowUps", () => {
  beforeEach(async () => {
    await resetDb();
    await storeSettings(db, { ...DEFAULT_SETTINGS, offer: "Sites para clínicas" });
    await db.insert(searches).values({ id: "s", niche: "Dentistas", city: "BH", maxResults: 1 });
    await db.insert(leads).values({
      id: "l",
      searchId: "s",
      placeId: "p",
      name: "Clínica",
      status: "contacted",
      contactedAt: new Date("2026-10-08T15:00:00Z"),
      followUpOn: "2026-10-11",
      analysisStatus: "done",
    });
    await db.insert(analyses).values({
      id: "a",
      leadId: "l",
      summary: "x",
      signals: [],
      painPoints: [],
      score: 50,
      scoreReasoning: "x",
      firstMessage: "Oi",
      model: "test-model",
    });
  });

  it("writes one reminder per follow-up day", async () => {
    const d = { db, analyzer: createFakeAnalyzer() };
    expect(await draftFollowUps(d, "2026-10-10")).toBe(0);
    expect(await draftFollowUps(d, "2026-10-11")).toBe(1);
    expect(await draftFollowUps(d, "2026-10-11")).toBe(0);
    expect(await db.query.leads.findFirst({ where: eq(leads.id, "l") })).toMatchObject({
      followUpMessage: "Lembrete para Clínica após 3 dias",
      followUpMessageFor: "2026-10-11",
    });
  });
});

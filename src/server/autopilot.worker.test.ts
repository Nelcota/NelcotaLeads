import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { searches } from "@/db/schema";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import { createFakePlaces } from "../../test/fake-places";
import { createFakeQueue } from "../../test/fake-queue";
import { resetDb } from "../../test/reset-db";
import { nextQuery, runAutopilot, type AutopilotDeps } from "./autopilot";
import { loadAutopilot, storeAutopilot, writeAutopilot } from "./settings-store";

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
      aiAutoReply: true,
      autoDispatch: false,
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

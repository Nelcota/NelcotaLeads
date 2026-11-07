import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { leads, searches, users } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { countLeads, queryLeads, queryLeadsCapped } from "./leads-query";

const db = getDb(env.DB);

describe("countLeads", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 5 });
    const base = { searchId: "s", siteStatus: "none" as const };
    await db.insert(leads).values([
      {
        ...base,
        id: "1",
        placeId: "1",
        name: "A",
        score: 80,
        status: "new",
        analysisStatus: "done",
      },
      {
        ...base,
        id: "2",
        placeId: "2",
        name: "B",
        score: 45,
        status: "contacted",
        followUpOn: "2026-10-10",
        analysisStatus: "done",
      },
      {
        ...base,
        id: "3",
        placeId: "3",
        name: "C",
        score: 10,
        status: "new",
        analysisStatus: "done",
      },
      { ...base, id: "4", placeId: "4", name: "D", score: null, status: "new" },
    ]);
  });

  it("counts each queue and score band", async () => {
    expect(await countLeads(db, {}, "2026-10-11")).toEqual({
      byView: {
        todo: 3,
        followup: 1,
        waiting: 1,
        talking: 0,
        closed: 0,
        discarded: 0,
        all: 4,
      },
      byTier: { high: 1, medium: 1, low: 1 },
      pending: 1,
      // B's follow-up day (10/10) is before today (11/10).
      overdue: 1,
    });
  });

  it("follow-up queue only includes leads due today or earlier", async () => {
    expect((await countLeads(db, {}, "2026-10-09")).byView.followup).toBe(0);
    const due = await queryLeads(db, { view: "followup" }, "2026-10-10");
    expect(due.map((lead) => lead.id)).toEqual(["2"]);
  });

  it("queue counts ignore the view filter; band counts ignore the score range", async () => {
    const counts = await countLeads(db, { view: "todo", minScore: 60 }, "2026-10-11");
    expect(counts.byView).toMatchObject({ todo: 1, waiting: 0 });
    expect(counts.byTier).toEqual({ high: 1, medium: 0, low: 1 });
  });
});

const names = async (q: string) =>
  (await queryLeads(db, { q, sort: "name", dir: "asc" })).map((lead) => lead.name);

const sorted = async (dir: "asc" | "desc") =>
  (await queryLeads(db, { sort: "name", dir })).map((lead) => lead.id);

describe("queryLeads search", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 5 });
    const base = { searchId: "s", siteStatus: "none" as const };
    await db.insert(leads).values([
      { ...base, id: "1", placeId: "1", name: "Clínica Sorriso" },
      { ...base, id: "2", placeId: "2", name: "Odonto_BH" },
      { ...base, id: "3", placeId: "3", name: "100% Dentes" },
      { ...base, id: "4", placeId: "4", name: String.raw`C:\Dente` },
    ]);
  });

  it("treats LIKE wildcards in the search text literally", async () => {
    expect(await names("_")).toEqual(["Odonto_BH"]);
    expect(await names("%")).toEqual(["100% Dentes"]);
    expect(await names("\\")).toEqual([String.raw`C:\Dente`]);
    expect(await names("sorriso")).toEqual(["Clínica Sorriso"]);
  });

  it("reports when rows past the limit were left out", async () => {
    expect(await queryLeadsCapped(db, {}, 4)).toMatchObject({ truncated: false });
    const capped = await queryLeadsCapped(db, {}, 3);
    expect(capped.rows).toHaveLength(3);
    expect(capped.truncated).toBe(true);
  });

  it("sorts both ways", async () => {
    expect(await sorted("asc")).toEqual(["3", "4", "1", "2"]);
    expect(await sorted("desc")).toEqual(["2", "1", "4", "3"]);
  });

  it("exports only the selected leads, whatever else is filtered", async () => {
    const rows = await queryLeads(db, { ids: ["2", "4", "nope"], sort: "name", dir: "asc" });
    expect(rows.map((lead) => lead.id)).toEqual(["4", "2"]);
  });
});

describe("queryLeads redesign filters", () => {
  const now = new Date("2026-11-07T15:00:00Z");

  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 5 });
    await db
      .insert(users)
      .values({ id: "u1", name: "Haniel", email: "haniel@nelcota.test", passwordHash: "x" });
    const base = { searchId: "s", siteStatus: "none" as const, analysisStatus: "done" as const };
    await db.insert(leads).values([
      {
        ...base,
        id: "1",
        placeId: "1",
        name: "Clínica Lumière",
        email: "ola@lumiere.test",
        phone: "(31) 3335-6610",
        address: "Rua A, Lourdes",
        score: 70,
        status: "replied",
        ownerId: "u1",
        createdAt: new Date("2026-10-01T12:00:00Z"),
      },
      {
        ...base,
        id: "2",
        placeId: "2",
        name: "Dental Prime",
        phone: "(31) 3014-8870",
        address: "Rua B, Savassi",
        score: 90,
        status: "new",
        createdAt: new Date("2026-11-07T10:00:00Z"),
      },
      {
        ...base,
        id: "3",
        placeId: "3",
        name: "Ortoclin",
        score: 60,
        status: "contacted",
        createdAt: new Date("2026-10-02T12:00:00Z"),
      },
    ]);
  });

  const ids = async (filters: Parameters<typeof queryLeads>[1]) =>
    (await queryLeads(db, filters, "2026-11-07", 100, now)).map((lead) => lead.id);

  it("searches the e-mail, the address and the phone digits", async () => {
    expect(await ids({ q: "lumiere.test" })).toEqual(["1"]);
    expect(await ids({ q: "Savassi" })).toEqual(["2"]);
    expect(await ids({ q: "3014-8870" })).toEqual(["2"]);
    expect(await ids({ q: "30148870" })).toEqual(["2"]);
  });

  it("'Meus leads' keeps the owner's leads and shows nothing without one", async () => {
    expect(await ids({ mine: true, ownerId: "u1" })).toEqual(["1"]);
    expect(await ids({ mine: true, ownerId: null })).toEqual([]);
  });

  it("'Chegaram hoje' keeps leads created in the last 24 hours", async () => {
    expect(await ids({ fresh: true })).toEqual(["2"]);
  });

  it("joins the owner's name for the row", async () => {
    const [row] = await queryLeads(db, { ids: ["1"] }, "2026-11-07", 100, now);
    expect(row?.ownerName).toBe("Haniel");
  });

  it("'Todos' follows the order of the tabs, then the score", async () => {
    expect(await ids({ view: "all" })).toEqual(["2", "3", "1"]);
  });
});

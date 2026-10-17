import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { emails, leads, searches } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { queryLeads } from "./leads-query";
import { queryNiches } from "./niches";

const db = getDb(env.DB);

const mail = {
  fromAddress: "a@x.com",
  toAddress: "b@x.com",
  subject: "Oi",
  body: "Oi",
};

describe("niches", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values([
      { id: "s1", niche: "Dentistas", city: "BH", maxResults: 5 },
      { id: "s2", niche: " dentistas", city: "SP", maxResults: 5 },
      { id: "s3", niche: "Biomedicina", city: "BH", maxResults: 5 },
    ]);
    const base = { siteStatus: "none" as const };
    await db.insert(leads).values([
      { ...base, id: "1", placeId: "1", name: "A", searchId: "s1", status: "closed" },
      { ...base, id: "2", placeId: "2", name: "B", searchId: "s2", status: "replied" },
      { ...base, id: "3", placeId: "3", name: "C", searchId: "s2", status: "new" },
      { ...base, id: "4", placeId: "4", name: "D", searchId: "s3", status: "contacted" },
    ]);
    await db.insert(emails).values([
      { ...mail, id: "e1", leadId: "1", direction: "out", status: "sent", author: "ai" },
      { ...mail, id: "e2", leadId: "1", direction: "in", status: "received", author: "lead" },
      { ...mail, id: "e3", leadId: "2", direction: "out", status: "sent", author: "ai" },
      { ...mail, id: "e4", leadId: "2", direction: "in", status: "received", author: "lead" },
      // A second reply still counts the lead once.
      { ...mail, id: "e5", leadId: "2", direction: "in", status: "received", author: "lead" },
      { ...mail, id: "e6", leadId: "4", direction: "out", status: "sent", author: "ai" },
      // Never sent: not contacted.
      { ...mail, id: "e7", leadId: "3", direction: "out", status: "draft", author: "ai" },
    ]);
  });

  it("merges spellings of a niche and counts its funnel, best closers first", async () => {
    const rows = await queryNiches(db);
    expect(rows.map(({ label: _label, ...row }) => row)).toEqual([
      {
        key: "dentistas",
        leads: 3,
        contacted: 2,
        replied: 2,
        closed: 1,
        repliedContacted: 2,
        closedContacted: 1,
      },
      {
        key: "biomedicina",
        leads: 1,
        contacted: 1,
        replied: 0,
        closed: 0,
        repliedContacted: 0,
        closedContacted: 0,
      },
    ]);
  });

  it("takes the shares from contacted leads only, so they never pass 100%", async () => {
    // Closed on WhatsApp, and one that wrote in by e-mail without being e-mailed first.
    await db.insert(leads).values([
      { siteStatus: "none", id: "5", placeId: "5", name: "E", searchId: "s3", status: "closed" },
      { siteStatus: "none", id: "6", placeId: "6", name: "F", searchId: "s3", status: "replied" },
    ]);
    await db.insert(emails).values({
      ...mail,
      id: "e8",
      leadId: "6",
      direction: "in",
      status: "received",
      author: "lead",
    });
    const biomedicina = (await queryNiches(db)).find((row) => row.key === "biomedicina");
    expect(biomedicina).toMatchObject({
      contacted: 1,
      replied: 1,
      closed: 1,
      repliedContacted: 0,
      closedContacted: 0,
    });
  });

  it("filters the leads list by niche", async () => {
    const rows = await queryLeads(db, { niche: "dentistas" });
    expect(rows.map((row) => row.id)).toEqual(["1", "2", "3"]);
  });
});

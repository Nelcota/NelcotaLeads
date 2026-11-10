import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { apiUsage, emails, leadEvents, leads, searches } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { queryNicheMetrics } from "./niches";
import { overviewMetrics } from "./overview-metrics";
import { periodRange } from "@/lib/period";

const db = getDb(env.DB);
// 14:00 on 03/11 in Brazil; "7 dias" is 28/10 to 03/11.
const now = new Date("2026-11-03T17:00:00Z");
const old = new Date("2026-09-01T15:00:00Z");
const at = (iso: string) => new Date(iso);

const mail = {
  fromAddress: "eu@nelcota.test",
  toAddress: "loja@x.test",
  subject: "Oi",
  body: "Oi",
};

async function seed() {
  await resetDb();
  await db.insert(searches).values([
    { id: "s1", niche: "Dentistas", city: "BH", maxResults: 5 },
    { id: "s2", niche: "padarias", city: "SP", maxResults: 5 },
  ]);
  await db.insert(leads).values([
    // Won this week, first e-mail by the AI, answered.
    {
      id: "a",
      placeId: "a",
      name: "A",
      searchId: "s1",
      email: "a@x.test",
      createdAt: now,
      status: "closed",
      closedAt: now,
      dealValueCents: 300_000,
    },
    // Lost this week on price, first e-mail by a person, bounced, never answered.
    {
      id: "b",
      placeId: "b",
      name: "B",
      searchId: "s1",
      email: "b@x.test",
      createdAt: now,
      status: "discarded",
      lossReason: "price",
      lostAt: now,
    },
    // Answered the AI and waits for a person.
    {
      id: "c",
      placeId: "c",
      name: "C",
      searchId: "s2",
      email: "c@x.test",
      createdAt: now,
      status: "replied",
      aiMode: false,
    },
    // Found and contacted in September, lost this week.
    {
      id: "d",
      placeId: "d",
      name: "D",
      searchId: "s2",
      email: "d@x.test",
      createdAt: old,
      status: "discarded",
      lossReason: "price",
      lostAt: now,
    },
    // Found this week without an e-mail, lost and unsubscribed this week.
    {
      id: "e",
      placeId: "e",
      name: "E",
      searchId: "s2",
      createdAt: now,
      status: "discarded",
      lossReason: "not_now",
      lostAt: now,
      unsubscribedAt: now,
    },
    // Closed in September: outside every period here.
    {
      id: "f",
      placeId: "f",
      name: "F",
      searchId: "s1",
      createdAt: old,
      status: "closed",
      closedAt: old,
      dealValueCents: 999_000,
    },
  ]);
  await db.insert(emails).values([
    {
      ...mail,
      id: "a1",
      leadId: "a",
      direction: "out",
      status: "sent",
      author: "ai",
      sentAt: at("2026-11-02T12:00:00Z"),
    },
    {
      ...mail,
      id: "a2",
      leadId: "a",
      direction: "in",
      status: "received",
      author: "lead",
      sentAt: at("2026-11-02T15:00:00Z"),
    },
    // A person's follow-up in the same thread: not a first e-mail.
    {
      ...mail,
      id: "a3",
      leadId: "a",
      direction: "out",
      status: "sent",
      author: "user",
      inReplyTo: "<a2>",
      sentAt: at("2026-11-02T16:00:00Z"),
    },
    {
      ...mail,
      id: "b1",
      leadId: "b",
      direction: "out",
      status: "sent",
      author: "user",
      sentAt: at("2026-11-01T12:00:00Z"),
      bouncedAt: at("2026-11-01T12:05:00Z"),
    },
    {
      ...mail,
      id: "c1",
      leadId: "c",
      direction: "out",
      status: "sent",
      author: "ai",
      sentAt: at("2026-11-02T12:00:00Z"),
    },
    {
      ...mail,
      id: "c2",
      leadId: "c",
      direction: "in",
      status: "received",
      author: "lead",
      sentAt: at("2026-11-02T13:00:00Z"),
    },
    {
      ...mail,
      id: "d1",
      leadId: "d",
      direction: "out",
      status: "sent",
      author: "ai",
      sentAt: at("2026-09-02T12:00:00Z"),
    },
  ]);
  await db.insert(apiUsage).values([
    { day: "2026-11-01", provider: "deepseek", costUsd: 1 },
    { day: "2026-11-03", provider: "deepseek", costUsd: 0.5 },
    { day: "2026-10-20", provider: "deepseek", costUsd: 2 },
    { day: "2026-11-02", provider: "google_places", costUsd: 7 },
  ]);
}

describe("overview metrics", () => {
  beforeAll(seed);

  it("counts the funnel, sending and business of the last 7 days", async () => {
    const metrics = await overviewMetrics(db, "7d", now);
    expect(metrics.funnel).toEqual({
      found: 4,
      withEmail: 3,
      contacted: 3,
      replied: 2,
      interested: 1,
      // Of the 3 first contacted this week (a, b, c): a won, b lost. D was contacted in
      // September, so its loss counts in `business.lost` but not in the rate.
      won: 1,
      lost: 1,
    });
    expect(metrics.sending).toEqual({ sent: 4, bounced: 1, unsubscribed: 1 });
    expect(metrics.business).toEqual({ won: 1, revenueCents: 300_000, lost: 3, aiCostUsd: 1.5 });
    expect(metrics.losses.toSorted((x, y) => y.count - x.count)).toEqual([
      { reason: "price", count: 2 },
      { reason: "not_now", count: 1 },
    ]);
  });

  it("compares replies to first e-mails written by the AI and by a person", async () => {
    const metrics = await overviewMetrics(db, "7d", now);
    expect(metrics.authors).toEqual({ ai: { sent: 2, replied: 2 }, user: { sent: 1, replied: 0 } });
  });

  it("projects the month's AI cost and widens with the period", async () => {
    const week = await overviewMetrics(db, "7d", now);
    expect(week.aiMonth.costUsd).toBeCloseTo(1.5);
    expect(week.aiMonth.projectionUsd).toBeCloseTo(15);
    expect(week.aiMonth.won).toBe(1);
    const month = await overviewMetrics(db, "30d", now);
    expect(month.business.aiCostUsd).toBeCloseTo(3.5);
  });

  it("splits the period by niche with revenue, losses and the top reason", async () => {
    const rows = await queryNicheMetrics(db, periodRange("7d", now));
    expect(rows).toEqual([
      {
        key: "dentistas",
        label: "Dentistas",
        leads: 2,
        contacted: 2,
        replied: 1,
        won: 1,
        revenueCents: 300_000,
        lost: 1,
        cohortWon: 1,
        cohortLost: 1,
        topLossReason: "price",
      },
      {
        key: "padarias",
        label: "Padarias",
        leads: 2,
        contacted: 1,
        replied: 1,
        won: 0,
        revenueCents: 0,
        lost: 2,
        // C is the only one contacted this week, and it is still talking.
        cohortWon: 0,
        cohortLost: 0,
        topLossReason: "price",
      },
    ]);
  });

  it("leaves out niches with nothing in the period", async () => {
    const rows = await queryNicheMetrics(db, {
      from: at("2026-01-01T03:00:00Z"),
      to: at("2026-01-08T03:00:00Z"),
    });
    expect(rows).toEqual([]);
  });

  it("backfills when old closed and lost deals happened, from the history first", async () => {
    await db.insert(leads).values([
      // Closed before closed_at existed, with a status event.
      { id: "g", placeId: "g", name: "G", searchId: "s1", createdAt: old, status: "closed" },
      // Closed without any event: its last e-mail dates it.
      {
        id: "h",
        placeId: "h",
        name: "H",
        searchId: "s1",
        createdAt: old,
        lastEmailAt: at("2026-10-20T12:00:00Z"),
        status: "closed",
      },
      // Lost with a reason, no lost_at: dated by its discard.
      {
        id: "i",
        placeId: "i",
        name: "I",
        searchId: "s1",
        createdAt: old,
        status: "discarded",
        lossReason: "price",
        discardedAt: at("2026-10-21T12:00:00Z"),
      },
      // An AI triage discard (no reason) is not a lost deal.
      { id: "j", placeId: "j", name: "J", searchId: "s1", createdAt: old, status: "discarded" },
    ]);
    await db.insert(leadEvents).values([
      {
        id: "ev-old",
        leadId: "g",
        kind: "status",
        fromValue: "replied",
        toValue: "closed",
        createdAt: at("2026-10-01T12:00:00Z"),
      },
      {
        id: "ev-new",
        leadId: "g",
        kind: "status",
        fromValue: "replied",
        toValue: "closed",
        createdAt: at("2026-10-10T12:00:00Z"),
      },
    ]);
    const backfill = env.TEST_MIGRATIONS.find((migration) =>
      migration.name.includes("backfill_closed_at"),
    );
    expect(backfill).toBeDefined();
    await env.DB.batch((backfill?.queries ?? []).map((query) => env.DB.prepare(query)));
    const row = (id: string) => db.query.leads.findFirst({ where: eq(leads.id, id) });
    expect((await row("g"))?.closedAt).toEqual(at("2026-10-10T12:00:00Z"));
    expect((await row("h"))?.closedAt).toEqual(at("2026-10-20T12:00:00Z"));
    expect((await row("i"))?.lostAt).toEqual(at("2026-10-21T12:00:00Z"));
    expect((await row("j"))?.lostAt).toBeNull();
    // Already dated deals keep their date.
    expect((await row("a"))?.closedAt).toEqual(now);
  });
});

describe("niche order", () => {
  beforeAll(async () => {
    await resetDb();
    await db.insert(searches).values([
      { id: "n1", niche: "Academias", city: "BH", maxResults: 5 },
      { id: "n2", niche: "Advocacia", city: "BH", maxResults: 5 },
      { id: "n3", niche: "Contabilidade", city: "BH", maxResults: 5 },
    ]);
    await db.insert(leads).values([
      // Only found this week: no contact, deal or loss.
      { id: "n1a", placeId: "n1a", name: "Academia", searchId: "n1", createdAt: now },
      { id: "n1b", placeId: "n1b", name: "Academia 2", searchId: "n1", createdAt: now },
      // Lost this week, contacted long ago.
      {
        id: "n2a",
        placeId: "n2a",
        name: "Advogado",
        searchId: "n2",
        createdAt: old,
        status: "discarded",
        lossReason: "has_provider",
        lostAt: now,
      },
      // Only found this week, with fewer leads than Academias.
      { id: "n3a", placeId: "n3a", name: "Contador", searchId: "n3", createdAt: now },
    ]);
  });

  it("puts niches with activity first and only-found ones last, most leads first", async () => {
    const rows = await queryNicheMetrics(db, periodRange("7d", now));
    expect(rows.map((row) => row.key)).toEqual(["advocacia", "academias", "contabilidade"]);
  });
});

import { env } from "cloudflare:test";
import { asc, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { emails, leads, searches } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { lastInboundAt, lateReply } from "./dashboard";

const db = getDb(env.DB);
const now = new Date("2026-11-03T17:00:00Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

const mail = { fromAddress: "a@x.test", toAddress: "b@x.test", subject: "Oi", body: "Oi" };

describe("late replies (the red badge and the cooling alert)", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
    const base = { searchId: "s", status: "replied" as const, aiMode: false };
    await db.insert(leads).values([
      // Wrote 30 h ago, nobody answered: late.
      { ...base, id: "late", placeId: "p1", name: "A", lastEmailAt: hoursAgo(30) },
      // Wrote 30 h ago, then an out-of-office 1 h ago: still late, by the real message.
      { ...base, id: "auto", placeId: "p2", name: "B", lastEmailAt: hoursAgo(1) },
      // Wrote 30 h ago and we answered after it: not late.
      { ...base, id: "answered", placeId: "p3", name: "C", lastEmailAt: hoursAgo(2) },
      // Wrote 3 h ago: not late yet.
      { ...base, id: "fresh", placeId: "p4", name: "D", lastEmailAt: hoursAgo(3) },
      // Replied on WhatsApp (no e-mail from them): falls back to the last e-mail, 40 h ago.
      { ...base, id: "phone", placeId: "p5", name: "E", lastEmailAt: hoursAgo(40) },
    ]);
    const inbound = {
      ...mail,
      direction: "in" as const,
      status: "received" as const,
      author: "lead" as const,
    };
    const outbound = {
      ...mail,
      direction: "out" as const,
      status: "sent" as const,
      author: "user" as const,
    };
    await db.insert(emails).values([
      { ...inbound, id: "l1", leadId: "late", sentAt: hoursAgo(30) },
      { ...inbound, id: "a1", leadId: "auto", sentAt: hoursAgo(30) },
      { ...inbound, id: "a2", leadId: "auto", sentAt: hoursAgo(1), automatic: true },
      { ...inbound, id: "c1", leadId: "answered", sentAt: hoursAgo(30) },
      { ...outbound, id: "c2", leadId: "answered", sentAt: hoursAgo(2) },
      { ...inbound, id: "f1", leadId: "fresh", sentAt: hoursAgo(3) },
      { ...outbound, id: "p1", leadId: "phone", sentAt: hoursAgo(40) },
    ]);
  });

  it("uses one rule: their last real message, over a day old, with nothing sent after it", async () => {
    const rows = await db
      .select({
        id: leads.id,
        late: sql<number>`case when ${lateReply(now)} then 1 else 0 end`.mapWith(Number),
        lastInboundAt: sql<number | null>`${lastInboundAt}`.mapWith(
          (value: number) => new Date(value * 1000),
        ),
      })
      .from(leads)
      .orderBy(asc(leads.id));
    expect(rows).toEqual([
      { id: "answered", late: 0, lastInboundAt: hoursAgo(30) },
      { id: "auto", late: 1, lastInboundAt: hoursAgo(30) },
      { id: "fresh", late: 0, lastInboundAt: hoursAgo(3) },
      { id: "late", late: 1, lastInboundAt: hoursAgo(30) },
      { id: "phone", late: 1, lastInboundAt: hoursAgo(40) },
    ]);
  });
});

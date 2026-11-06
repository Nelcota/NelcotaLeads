import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { analyses, emails, leads, searches, settings as settingsTable } from "@/db/schema";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import { createFakeMailer, incoming } from "../../test/fake-mailer";
import { resetDb } from "../../test/reset-db";
import { closeConversation, undoCloseConversation } from "./conversation";
import { CONVERSATIONS_LIMIT, queryConversations } from "./mail";
import {
  AUTO_DISPATCH_PER_RUN,
  autoDispatch,
  handleInbound,
  mailDailyLimit,
  prepareDrafts,
  queueDrafts,
  receivedAt,
} from "./mail-flow";
import { DEFAULT_SETTINGS, storeSettings } from "./settings-store";
import { dailyLimit, MAX_DAILY_LIMIT, placesDailyLimit } from "./usage";

/**
 * Bounds that only show with volume: D1 refuses a query with more than 100 bound parameters,
 * so every list that grows with the data (a selection, the conversations) must stay under it.
 */
const db = getDb(env.DB);
const analyzer = createFakeAnalyzer();
const FROM = "eu@exemplo.com.br";

/** `count` analyzed new leads with an e-mail, inserted in chunks D1 accepts. */
async function seedLeads(count: number, extra: Partial<typeof leads.$inferInsert> = {}) {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: `l${i}`,
    searchId: "s",
    placeId: `p${i}`,
    name: `Lead ${i}`,
    email: `contato${i}@clinica.com.br`,
    siteStatus: "ok" as const,
    analysisStatus: "done" as const,
    ...extra,
  }));
  for (let i = 0; i < rows.length; i += 5) await db.insert(leads).values(rows.slice(i, i + 5));
  const base = { summary: "x", signals: [], painPoints: [], score: 50, scoreReasoning: "x" };
  for (let i = 0; i < rows.length; i += 5) {
    await db
      .insert(analyses)
      .values(
        rows
          .slice(i, i + 5)
          .map((row) => ({ ...base, id: `an-${row.id}`, leadId: row.id, model: "m" })),
      );
  }
  return rows.map((row) => row.id);
}

beforeEach(async () => {
  await resetDb();
  await storeSettings(db, { ...DEFAULT_SETTINGS, offer: "Sites para clínicas", senderName: "Ana" });
  await db.insert(searches).values({ id: "s", niche: "Dentistas", city: "BH", maxResults: 60 });
});

describe("lists past D1's 100 bound parameters", () => {
  it("drafts a full dispatch selection of 100 leads", async () => {
    const ids = await seedLeads(100);
    const { drafts, skipped } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ids);
    expect(skipped).toEqual([]);
    expect(drafts).toHaveLength(100);
    // Asked again, every lead reuses its draft (the query that loads them has 100 ids too).
    expect((await prepareDrafts({ db, analyzer, fromAddress: FROM }, ids)).drafts).toHaveLength(
      100,
    );
  });

  it("queues more than 100 drafts at once", async () => {
    const ids = await seedLeads(150);
    const { drafts } = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ids.slice(0, 100));
    const more = await prepareDrafts({ db, analyzer, fromAddress: FROM }, ids.slice(100));
    const all = [...drafts, ...more.drafts].map((draft) => draft.id);
    expect(await queueDrafts(db, all, new Date("2026-10-11T12:00:00Z"))).toBe(150);
  });

  it("lists more than 100 conversations", async () => {
    await seedLeads(150, { status: "contacted", lastEmailAt: new Date("2026-10-11T12:00:00Z") });
    expect(await queryConversations(db)).toHaveLength(150);
  });

  it("never cuts off a conversation that waits for you, however old", async () => {
    const total = CONVERSATIONS_LIMIT + 5;
    await seedLeads(total, { status: "contacted", lastEmailAt: new Date("2026-10-11T12:00:00Z") });
    // The oldest conversation of all is the one asking for the user.
    await db
      .update(leads)
      .set({ status: "replied", aiMode: false, lastEmailAt: new Date("2026-01-01T12:00:00Z") })
      .where(eq(leads.id, "l0"));
    const rows = await queryConversations(db);
    expect(rows).toHaveLength(CONVERSATIONS_LIMIT);
    expect(rows.at(-1)).toMatchObject({ id: "l0", state: "needsYou" });
  });

  it("closes and reopens a conversation with many pending e-mails", async () => {
    const [id = ""] = await seedLeads(1, { status: "replied" });
    const pending = Array.from({ length: 120 }, (_, i) => ({
      id: `q${i}`,
      leadId: id,
      direction: "out" as const,
      status: "queued" as const,
      author: "ai" as const,
      fromAddress: FROM,
      toAddress: "contato0@clinica.com.br",
      subject: "Oi",
      body: "Oi",
    }));
    for (let i = 0; i < pending.length; i += 5)
      await db.insert(emails).values(pending.slice(i, i + 5));
    const snapshot = await closeConversation(db, id, "discarded", new Date(), { automatic: true });
    expect(snapshot.cancelledIds.queued).toHaveLength(120);
    await undoCloseConversation(db, id, snapshot);
    expect(await db.$count(emails, eq(emails.status, "queued"))).toBe(120);
  });
});

describe("automatic dispatch", () => {
  it("drafts at most AUTO_DISPATCH_PER_RUN e-mails per run, whatever the daily limit", async () => {
    await seedLeads(AUTO_DISPATCH_PER_RUN + 10);
    await db.update(settingsTable).set({ autoDispatch: true });
    const queued = await autoDispatch(
      { db, analyzer, fromAddress: FROM, limit: MAX_DAILY_LIMIT },
      new Date("2026-10-11T12:00:00Z"),
    );
    expect(queued).toBe(AUTO_DISPATCH_PER_RUN);
  });
});

describe("daily limits from env vars", () => {
  it("accepts whole numbers from 0 to the maximum, inclusive", () => {
    expect(dailyLimit("0", 7)).toBe(0);
    expect(dailyLimit("1", 7)).toBe(1);
    expect(dailyLimit(String(MAX_DAILY_LIMIT), 7)).toBe(MAX_DAILY_LIMIT);
    expect(dailyLimit(" 30 ", 7)).toBe(30);
  });

  it("falls back to the default outside it", () => {
    for (const value of [
      undefined,
      "",
      "  ",
      "-1",
      "1.5",
      "abc",
      String(MAX_DAILY_LIMIT + 1),
      "1e300",
      "Infinity",
      "NaN",
    ]) {
      expect(dailyLimit(value, 7)).toBe(7);
    }
    expect(mailDailyLimit("1e300")).toBe(30);
    expect(placesDailyLimit("99999999")).toBe(50);
  });
});

describe("AI replies in one conversation", () => {
  it("hands over once the AI has queued its sixth answer, sent or not", async () => {
    const [id = ""] = await seedLeads(1, { status: "contacted" });
    const fake = createFakeMailer();
    await db.insert(emails).values({
      id: "first",
      leadId: id,
      direction: "out",
      status: "sent",
      author: "ai",
      fromAddress: FROM,
      toAddress: "contato0@clinica.com.br",
      subject: "Oi",
      body: "Oi",
      messageId: "<first@exemplo.com.br>",
      sentAt: new Date("2026-10-11T12:00:00Z"),
    });
    // The lead writes again before each queued answer goes out, which cancels it.
    for (let i = 0; i < 7; i++) {
      await handleInbound(
        { db, mailer: fake.mailer, analyzer },
        incoming({
          from: "contato0@clinica.com.br",
          inReplyTo: "<first@exemplo.com.br>",
          text: `Pode me contar mais? (${i})`,
        }),
        new Date(`2026-10-11T12:0${i}:00Z`),
      );
    }
    const answers = (await db.select().from(emails).where(eq(emails.leadId, id))).filter(
      (row) => row.direction === "out" && row.author === "ai" && row.inReplyTo,
    );
    expect(answers).toHaveLength(6);
    expect((await db.query.leads.findFirst({ where: eq(leads.id, id) }))?.aiMode).toBe(false);
  });
});

describe("receivedAt", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const minutes = (n: number) => new Date(now.getTime() + n * 60_000);

  it("keeps a plausible Date header", () => {
    expect(receivedAt(minutes(-5), now)).toEqual(minutes(-5));
    expect(receivedAt(minutes(10), now)).toEqual(minutes(10));
    expect(receivedAt(minutes(-30 * 24 * 60), now)).toEqual(minutes(-30 * 24 * 60));
  });

  it("uses the time it was read for a missing or implausible one", () => {
    expect(receivedAt(null, now)).toBe(now);
    expect(receivedAt(new Date(minutes(10).getTime() + 1), now)).toBe(now);
    expect(receivedAt(new Date(minutes(-30 * 24 * 60).getTime() - 1), now)).toBe(now);
    expect(receivedAt(new Date("2099-01-01T00:00:00Z"), now)).toBe(now);
    expect(receivedAt(new Date(0), now)).toBe(now);
  });
});

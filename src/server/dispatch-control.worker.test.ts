import { env } from "cloudflare:test";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { analyses, emails, leads, searches, settings as settingsTable } from "@/db/schema";
import { createFakeAnalyzer } from "../../test/fake-analyzer";
import { createFakeMailer } from "../../test/fake-mailer";
import { resetDb } from "../../test/reset-db";
import {
  cancelTodaysDispatch,
  pauseDispatch,
  resumeDispatch,
  saveSendWindow,
} from "./dispatch-control";
import {
  autoDispatch,
  DISPATCH_CANCELLED_REASON,
  prepareDrafts,
  queueDrafts,
  sendDue,
} from "./mail-flow";
import { DEFAULT_SETTINGS, loadDispatchControl, storeSettings } from "./settings-store";

const db = getDb(env.DB);
const FROM = "eu@exemplo.com.br";
// Brazil is UTC-3: 12:00Z is 09:00 there (inside 6h–18h), 01:00Z is 22:00 of the day before.
const MORNING = new Date("2026-11-03T12:00:00Z");
const NIGHT = new Date("2026-11-04T01:00:00Z");
const NEXT_OPENING = new Date("2026-11-04T09:00:00Z");
const GAP_MS = 8 * 60_000;

async function seedLeads(scores: Record<string, number | null>) {
  await storeSettings(db, { ...DEFAULT_SETTINGS, offer: "Sites para clínicas" });
  await db.insert(searches).values({ id: "s", niche: "Dentistas", city: "BH", maxResults: 5 });
  await db.insert(leads).values(
    Object.entries(scores).map(([id, score], index) => ({
      id,
      placeId: id,
      searchId: "s",
      name: `Clínica ${id}`,
      email: `${id}@clinica.com.br`,
      score,
      analysisStatus: "done" as const,
      createdAt: new Date(Date.UTC(2026, 9, 1 + index)),
    })),
  );
  await db.insert(analyses).values(
    Object.entries(scores).map(([leadId, score]) => ({
      id: `an-${leadId}`,
      leadId,
      summary: "x",
      signals: [],
      painPoints: [],
      score: score ?? 0,
      scoreReasoning: "x",
      model: "m",
    })),
  );
}

async function draftFor(leadId: string, overrides: Partial<typeof emails.$inferInsert> = {}) {
  const id = `${leadId}-${crypto.randomUUID()}`;
  await db.insert(emails).values({
    id,
    leadId,
    direction: "out",
    status: "draft",
    author: "ai",
    fromAddress: FROM,
    toAddress: `${leadId}@clinica.com.br`,
    subject: "Assunto",
    body: "Texto",
    ...overrides,
  });
  return id;
}

const send = (now: Date) => {
  const fake = createFakeMailer();
  return { fake, run: () => sendDue({ db, mailer: fake.mailer, limit: 30 }, now) };
};

const emailRow = (id: string) => db.query.emails.findFirst({ where: eq(emails.id, id) });

describe("send window and pause", () => {
  beforeEach(async () => {
    await resetDb();
    await seedLeads({ a: 50, b: 90, c: 70 });
  });

  it("queues in score order, highest first, one gap apart", async () => {
    const ids = await Promise.all(["a", "b", "c"].map((lead) => draftFor(lead)));
    expect(await queueDrafts(db, ids, MORNING)).toBe(3);
    const queued = await db
      .select({ leadId: emails.leadId, sendAfter: emails.sendAfter })
      .from(emails)
      .where(eq(emails.status, "queued"))
      .orderBy(asc(emails.sendAfter));
    expect(queued.map((row) => row.leadId)).toEqual(["b", "c", "a"]);
    expect(queued.map((row) => row.sendAfter?.getTime())).toEqual([
      MORNING.getTime(),
      MORNING.getTime() + GAP_MS,
      MORNING.getTime() + 2 * GAP_MS,
    ]);

    const { fake, run } = send(new Date(MORNING.getTime() + 3 * GAP_MS));
    expect(await run()).toBe(1);
    expect(fake.sent[0]?.to).toBe("b@clinica.com.br");
  });

  it("puts a higher-score lead queued later ahead of the ones already waiting", async () => {
    await queueDrafts(db, [await draftFor("a")], MORNING);
    await queueDrafts(db, [await draftFor("b")], MORNING);
    const queued = await db
      .select({ leadId: emails.leadId })
      .from(emails)
      .where(eq(emails.status, "queued"))
      .orderBy(asc(emails.sendAfter));
    expect(queued.map((row) => row.leadId)).toEqual(["b", "a"]);
  });

  it("slots e-mails queued at night at the next opening and sends nothing before it", async () => {
    const id = await draftFor("a");
    await queueDrafts(db, [id], NIGHT);
    expect((await emailRow(id))?.sendAfter).toEqual(NEXT_OPENING);

    // Due long ago but outside the window: it waits instead of being lost.
    await db.update(emails).set({ sendAfter: MORNING }).where(eq(emails.id, id));
    expect(await send(NIGHT).run()).toBe(0);
    expect((await emailRow(id))?.status).toBe("queued");
    expect(await send(NEXT_OPENING).run()).toBe(1);
    expect((await emailRow(id))?.status).toBe("sent");
  });

  it("follows the saved window", async () => {
    await saveSendWindow(db, { start: 8, end: 12 });
    expect(await loadDispatchControl(db)).toMatchObject({ start: 8, end: 12 });
    const id = await draftFor("a");
    await queueDrafts(db, [id], MORNING);
    // 13:00 in Brazil is past 12h; 11:00 is inside 8h–12h.
    expect(await send(new Date("2026-11-03T16:00:00Z")).run()).toBe(0);
    expect(await send(new Date("2026-11-03T14:00:00Z")).run()).toBe(1);
  });

  it("holds first e-mails and follow-ups while paused and sends again after resuming", async () => {
    const first = await draftFor("a");
    await queueDrafts(db, [first], MORNING);
    const followUp = await draftFor("b", {
      status: "queued",
      subject: "Re: Assunto",
      sendAfter: MORNING,
    });
    await pauseDispatch(db, MORNING);
    expect(await send(MORNING).run()).toBe(0);
    expect((await emailRow(first))?.status).toBe("queued");
    expect((await emailRow(followUp))?.status).toBe("queued");

    await resumeDispatch(db);
    expect((await loadDispatchControl(db)).pausedAt).toBeNull();
    expect(await send(MORNING).run()).toBe(1);
  });

  it("keeps answering ongoing conversations at night and while paused", async () => {
    await pauseDispatch(db, NIGHT);
    const aiReply = await draftFor("a", {
      status: "queued",
      inReplyTo: "<lead@clinica.com.br>",
      sendAfter: NIGHT,
    });
    const userEmail = await draftFor("b", {
      status: "queued",
      author: "user",
      sendAfter: NIGHT,
    });
    expect(await send(NIGHT).run()).toBe(1);
    // Written by a person without In-Reply-To: still waits for the gap, never for the window.
    expect(await send(new Date(NIGHT.getTime() + GAP_MS + 60_000)).run()).toBe(1);
    expect((await emailRow(aiReply))?.status).toBe("sent");
    expect((await emailRow(userEmail))?.status).toBe("sent");
  });

  it("keeps the gap between cold e-mails", async () => {
    const ids = await Promise.all(["a", "b"].map((lead) => draftFor(lead)));
    await queueDrafts(db, ids, MORNING);
    // Both due: the second still waits for the gap after the first.
    const later = new Date(MORNING.getTime() + GAP_MS);
    await db.update(emails).set({ sendAfter: MORNING }).where(eq(emails.status, "queued"));
    expect(await send(MORNING).run()).toBe(1);
    expect(await send(new Date(MORNING.getTime() + 60_000)).run()).toBe(0);
    expect(await send(new Date(later.getTime() + 1000)).run()).toBe(1);
  });

  it("skips the automatic dispatch while paused", async () => {
    await db
      .insert(settingsTable)
      .values({ id: 1, ...DEFAULT_SETTINGS })
      .onConflictDoNothing();
    await db.update(settingsTable).set({ autoDispatch: true, dispatchPausedAt: MORNING });
    const deps = { db, analyzer: createFakeAnalyzer(), fromAddress: FROM, limit: 30 };
    expect(await autoDispatch(deps, MORNING)).toBe(0);
  });
});

describe("cancel today's dispatch", () => {
  beforeEach(async () => {
    await resetDb();
    await seedLeads({ a: 50, b: 90, c: 70, d: 60 });
  });

  it("cancels only the first e-mails still waiting and lets the leads be drafted again", async () => {
    const ids = await Promise.all(["a", "b"].map((lead) => draftFor(lead)));
    await queueDrafts(db, ids, MORNING);
    // Already sent to c, and a follow-up waiting for it: neither is touched.
    const sent = await draftFor("c", { status: "sent", sentAt: MORNING, messageId: "<m@x>" });
    const followUp = await draftFor("c", {
      status: "queued",
      subject: "Re: Assunto",
      sendAfter: MORNING,
    });
    // An answer in d's conversation stays queued too.
    const reply = await draftFor("d", { status: "queued", inReplyTo: "<d@x>", sendAfter: MORNING });

    expect(await cancelTodaysDispatch(db, MORNING)).toBe(2);
    for (const id of ids) {
      expect(await emailRow(id)).toMatchObject({
        status: "cancelled",
        error: DISPATCH_CANCELLED_REASON,
      });
    }
    expect((await emailRow(sent))?.status).toBe("sent");
    expect((await emailRow(followUp))?.status).toBe("queued");
    expect((await emailRow(reply))?.status).toBe("queued");
    expect((await db.query.leads.findFirst({ where: eq(leads.id, "a") }))?.status).toBe("new");

    // Not counted as contacted: a manual selection drafts the lead again.
    const { drafts, skipped } = await prepareDrafts(
      { db, analyzer: createFakeAnalyzer(), fromAddress: FROM },
      ["a"],
    );
    expect(skipped).toEqual([]);
    expect(drafts).toHaveLength(1);
  });

  it("puts a lead marked contacted without a contact back to new, with who did it", async () => {
    const id = await draftFor("a");
    await queueDrafts(db, [id], MORNING);
    await db.update(leads).set({ status: "contacted" }).where(eq(leads.id, "a"));
    expect(await cancelTodaysDispatch(db, MORNING)).toBe(1);
    expect((await db.query.leads.findFirst({ where: eq(leads.id, "a") }))?.status).toBe("new");
    const events = await db.query.leadEvents.findMany();
    expect(events).toEqual([
      expect.objectContaining({ leadId: "a", fromValue: "contacted", toValue: "new" }),
    ]);
  });

  it("keeps the automatic dispatch from drafting the cancelled leads again today", async () => {
    await db.update(settingsTable).set({ autoDispatch: true });
    const id = await draftFor("a");
    await queueDrafts(db, [id], MORNING);
    await cancelTodaysDispatch(db, MORNING);
    const deps = { db, analyzer: createFakeAnalyzer(), fromAddress: FROM, limit: 30 };
    await autoDispatch(deps, MORNING);
    const forA = await db.select().from(emails).where(eq(emails.leadId, "a"));
    expect(forA.map((row) => row.status)).toEqual(["cancelled"]);

    // The next day it is a candidate again.
    const tomorrow = new Date(MORNING.getTime() + 24 * 60 * 60_000);
    await autoDispatch(deps, tomorrow);
    const again = await db.select().from(emails).where(eq(emails.leadId, "a"));
    expect(again.map((row) => row.status).toSorted()).toEqual(["cancelled", "queued"]);
  });
});

const dispatchDeps = (analyzer = createFakeAnalyzer()) => ({
  db,
  analyzer,
  fromAddress: FROM,
  limit: 30,
});

describe("cancel stops the day's run", () => {
  beforeEach(async () => {
    await resetDb();
    await seedLeads({ a: 50, b: 90 });
    await db.update(settingsTable).set({ autoDispatch: true });
  });

  it("drafts nothing more today, not even for leads it never cancelled, and runs tomorrow", async () => {
    await queueDrafts(db, [await draftFor("a")], MORNING);
    await cancelTodaysDispatch(db, MORNING);
    expect((await db.query.settings.findFirst())?.dispatchCancelledOn).toBe("2026-11-03");
    expect(await autoDispatch(dispatchDeps(), MORNING)).toBe(0);
    expect(await db.select().from(emails).where(eq(emails.leadId, "b"))).toEqual([]);

    const tomorrow = new Date(MORNING.getTime() + 24 * 60 * 60_000);
    expect(await autoDispatch(dispatchDeps(), tomorrow)).toBe(2);
  });

  it("keeps drafts written during a cancel out of the queue", async () => {
    const base = createFakeAnalyzer();
    const cancelling = {
      ...base,
      writeEmail: async (...args: Parameters<typeof base.writeEmail>) => {
        await cancelTodaysDispatch(db, MORNING);
        return base.writeEmail(...args);
      },
    };
    expect(await autoDispatch(dispatchDeps(cancelling), MORNING)).toBe(0);
    const rows = await db.select().from(emails);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === "draft")).toBe(true);
  });

  it("only cancels the e-mails due before tomorrow", async () => {
    // Queued at night: its slot is tomorrow's opening, outside today's run.
    const id = await draftFor("a");
    await queueDrafts(db, [id], NIGHT);
    expect(await cancelTodaysDispatch(db, NIGHT)).toBe(0);
    expect((await emailRow(id))?.status).toBe("queued");
  });
});

describe("saving the send window", () => {
  beforeEach(async () => {
    await resetDb();
    await seedLeads({ a: 50, b: 90 });
  });

  it("moves the queued cold e-mails into the new hours", async () => {
    const ids = await Promise.all(["a", "b"].map((lead) => draftFor(lead)));
    await queueDrafts(db, ids, MORNING);
    // From 09:00 to 10:00–12:00 Brazil time: the first slot is 10:00 (13:00Z).
    await saveSendWindow(db, { start: 10, end: 12 }, MORNING);
    const queued = await db
      .select({ leadId: emails.leadId, sendAfter: emails.sendAfter })
      .from(emails)
      .where(eq(emails.status, "queued"))
      .orderBy(asc(emails.sendAfter));
    const opening = new Date("2026-11-03T13:00:00Z").getTime();
    expect(queued.map((row) => [row.leadId, row.sendAfter?.getTime()])).toEqual([
      ["b", opening],
      ["a", opening + GAP_MS],
    ]);
  });
});

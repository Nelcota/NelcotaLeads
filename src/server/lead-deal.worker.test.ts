import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { emails, leadEvents, leads, meetings, searches, users } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import {
  closeConversation,
  LOST_NEEDS_REASON_MESSAGE,
  undoCloseConversation,
  WON_NEEDS_DEAL_MESSAGE,
} from "./conversation";
import {
  changeOwner,
  changeSalesStage,
  closeLostDeal,
  closeWonDeal,
  FUTURE_CLOSE_MESSAGE,
  STAGE_NEEDS_REPLY_MESSAGE,
} from "./lead-deal";
import { editLead } from "./lead-edit";
import { leadHistory } from "./lead-events";
import { UNSUBSCRIBED_MESSAGE } from "./lead-status";
import { addressUnsubscribed } from "./mail-flow";

const db = getDb(env.DB);
// 14:00 in Brazil.
const now = new Date("2026-11-03T17:00:00Z");
const later = new Date("2026-11-03T18:00:00Z");

const lead = async (id = "a") => db.query.leads.findFirst({ where: eq(leads.id, id) });
const events = (id = "a") =>
  db
    .select({
      kind: leadEvents.kind,
      from: leadEvents.fromValue,
      to: leadEvents.toValue,
      userId: leadEvents.userId,
    })
    .from(leadEvents)
    .where(eq(leadEvents.leadId, id));

describe("deal outcomes", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
    await db.insert(users).values([
      { id: "u1", name: "Haniel", email: "haniel@nelcota.test", passwordHash: "x" },
      { id: "u2", name: "Bia", email: "bia@nelcota.test", passwordHash: "x" },
    ]);
    const base = { searchId: "s", email: "contato@loja.test", contactedAt: now };
    await db.insert(leads).values([
      { ...base, id: "a", placeId: "pa", name: "Loja A", status: "replied", aiMode: true },
      { ...base, id: "b", placeId: "pb", name: "Loja B", status: "contacted" },
      { ...base, id: "n", placeId: "pn", name: "Loja N", status: "new", contactedAt: null },
    ]);
  });

  it("closes a deal won with its value, day and service, and records it", async () => {
    await db.insert(emails).values({
      id: "q",
      leadId: "a",
      direction: "out",
      author: "ai",
      status: "queued",
      fromAddress: "eu@nelcota.test",
      toAddress: "contato@loja.test",
      subject: "Oi",
      body: "Oi",
    });
    await closeWonDeal(
      db,
      { id: "a", valueCents: 149_000, closedOn: "2026-11-03", service: "Site institucional" },
      "u1",
      now,
    );
    expect(await lead()).toMatchObject({
      status: "closed",
      closedAt: now,
      dealValueCents: 149_000,
      dealService: "Site institucional",
      lossReason: null,
      aiMode: false,
    });
    // Like ending the conversation: nothing pending goes out after the deal.
    expect(await db.query.emails.findFirst({ where: eq(emails.id, "q") })).toMatchObject({
      status: "cancelled",
    });
    expect(await events()).toEqual(
      expect.arrayContaining([
        { kind: "status", from: "replied", to: "closed", userId: "u1" },
        { kind: "won", from: null, to: "149000", userId: "u1" },
      ]),
    );
  });

  it("dates an earlier close at midday and refuses a future one", async () => {
    await closeWonDeal(
      db,
      { id: "a", valueCents: 100, closedOn: "2026-11-01", service: "Site" },
      "u1",
      now,
    );
    expect((await lead())?.closedAt).toEqual(new Date("2026-11-01T15:00:00Z"));
    await expect(
      closeWonDeal(
        db,
        { id: "b", valueCents: 100, closedOn: "2026-11-04", service: "Site" },
        "u1",
        now,
      ),
    ).rejects.toThrow(FUTURE_CLOSE_MESSAGE);
  });

  it("refuses to close what cannot be closed", async () => {
    const deal = { valueCents: 100, closedOn: "2026-11-03", service: "Site" };
    await expect(closeWonDeal(db, { id: "n", ...deal }, "u1", now)).rejects.toThrow(
      "Não é possível mudar o lead",
    );
    await closeWonDeal(db, { id: "a", ...deal }, "u1", now);
    await expect(closeWonDeal(db, { id: "a", ...deal }, "u1", now)).rejects.toThrow(
      "já está encerrada",
    );
  });

  it("closes a deal lost with the reason, also as the discard reason", async () => {
    await closeLostDeal(db, { id: "b", reason: "price", note: "Achou caro" }, "u2", now);
    expect(await lead("b")).toMatchObject({
      status: "discarded",
      lossReason: "price",
      lossNote: "Achou caro",
      lostAt: now,
      discardReason: "Preço alto",
      closedAt: null,
      dealValueCents: null,
    });
    expect(await events("b")).toEqual(
      expect.arrayContaining([
        { kind: "status", from: "contacted", to: "discarded", userId: "u2" },
        { kind: "lost", from: null, to: "price", userId: "u2" },
      ]),
    );
  });

  it("forgets the outcome when the lead is reopened or put back in the queue", async () => {
    await changeSalesStage(db, { id: "a", stage: "proposal" }, "u1", now);
    await closeWonDeal(
      db,
      { id: "a", valueCents: 500, closedOn: "2026-11-03", service: "Site" },
      "u1",
      now,
    );
    await editLead(db, { id: "a", status: "replied" }, "u1", later);
    expect(await lead()).toMatchObject({
      status: "replied",
      closedAt: null,
      dealValueCents: null,
      dealService: null,
      // Reopened where it was in the sale.
      salesStage: "proposal",
    });

    await closeLostDeal(db, { id: "b", reason: "not_now" }, "u1", now);
    await editLead(db, { id: "b", status: "new" }, "u1", later);
    expect(await lead("b")).toMatchObject({
      status: "new",
      lossReason: null,
      lossNote: null,
      lostAt: null,
      discardReason: null,
    });
    expect(await events("b")).toContainEqual({
      kind: "status",
      from: "discarded",
      to: "new",
      userId: "u1",
    });
  });

  it("undoing a close from Conversas forgets the outcome too", async () => {
    const snapshot = await closeConversation(db, "a", "closed", now, {
      userId: "u1",
      deal: { dealValueCents: 900, dealService: "Site", closedAt: now },
    });
    await undoCloseConversation(db, "a", snapshot, { userId: "u1", now: later });
    expect(await lead()).toMatchObject({ status: "replied", dealValueCents: null, closedAt: null });
    expect(await events()).toEqual(
      expect.arrayContaining([
        { kind: "status", from: "replied", to: "closed", userId: "u1" },
        { kind: "status", from: "closed", to: "replied", userId: "u1" },
      ]),
    );
  });
});

describe("status, stage and owner events", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
    await db.insert(users).values({
      id: "u1",
      name: "Haniel",
      email: "haniel@nelcota.test",
      passwordHash: "x",
    });
    await db.insert(leads).values([
      { id: "a", searchId: "s", placeId: "pa", name: "Loja A", status: "replied" },
      { id: "n", searchId: "s", placeId: "pn", name: "Loja N", status: "new" },
    ]);
  });

  it("records a status change made in the lead panel, and nothing for notes", async () => {
    await editLead(db, { id: "n", status: "contacted" }, "u1", now);
    await editLead(db, { id: "n", notes: "ligar de tarde" }, "u1", now);
    expect(await events("n")).toEqual([
      { kind: "status", from: "new", to: "contacted", userId: "u1" },
    ]);
  });

  it("moves a replied lead through meeting and proposal, once per change", async () => {
    await changeSalesStage(db, { id: "a", stage: "meeting" }, "u1", now);
    await changeSalesStage(db, { id: "a", stage: "meeting" }, "u1", now);
    await changeSalesStage(db, { id: "a", stage: "proposal" }, "u1", later);
    await changeSalesStage(db, { id: "a", stage: null }, "u1", later);
    expect((await lead())?.salesStage).toBeNull();
    expect(await events()).toEqual([
      { kind: "stage", from: null, to: "meeting", userId: "u1" },
      { kind: "stage", from: "meeting", to: "proposal", userId: "u1" },
      { kind: "stage", from: "proposal", to: null, userId: "u1" },
    ]);
    await expect(changeSalesStage(db, { id: "n", stage: "meeting" }, "u1", now)).rejects.toThrow(
      STAGE_NEEDS_REPLY_MESSAGE,
    );
  });

  it("takes and frees a lead, naming who did it in the history", async () => {
    await changeOwner(db, { id: "a", owner: "me" }, "u1", now);
    expect((await lead())?.ownerId).toBe("u1");
    await changeOwner(db, { id: "a", owner: "me" }, "u1", now);
    await changeOwner(db, { id: "a", owner: null }, "u1", later);
    expect((await lead())?.ownerId).toBeNull();
    expect(await events()).toEqual([
      { kind: "owner", from: null, to: "u1", userId: "u1" },
      { kind: "owner", from: "u1", to: null, userId: "u1" },
    ]);
    await expect(changeOwner(db, { id: "a", owner: "me" }, null, now)).rejects.toThrow(
      "Sessão expirada",
    );
  });

  it("lists the history newest first with the person's name", async () => {
    await changeOwner(db, { id: "a", owner: "me" }, "u1", now);
    await changeSalesStage(db, { id: "a", stage: "meeting" }, null, later);
    expect(await leadHistory(db, "a")).toEqual([
      expect.objectContaining({ kind: "stage", toValue: "meeting", userName: null }),
      expect.objectContaining({ kind: "owner", toValue: "u1", userName: "Haniel" }),
    ]);
  });
});

const meeting = (id: string) => db.query.meetings.findFirst({ where: eq(meetings.id, id) });
const email = (id: string) => db.query.emails.findFirst({ where: eq(emails.id, id) });

describe("closing guards", () => {
  const tomorrow = new Date("2026-11-04T17:00:00Z");
  const yesterday = new Date("2026-11-02T17:00:00Z");
  const mail = {
    leadId: "a",
    direction: "out" as const,
    author: "user" as const,
    status: "queued" as const,
    fromAddress: "eu@nelcota.test",
    toAddress: "contato@loja.test",
    subject: "Convite",
    body: "Oi",
    sendAfter: tomorrow,
  };

  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
    await db.insert(users).values([
      { id: "u1", name: "Haniel", email: "haniel@nelcota.test", passwordHash: "x" },
      { id: "u2", name: "Bia", email: "bia@nelcota.test", passwordHash: "x" },
    ]);
    await db.insert(leads).values([
      {
        id: "a",
        searchId: "s",
        placeId: "pa",
        name: "Loja A",
        email: "contato@loja.test",
        status: "replied",
        contactedAt: now,
      },
    ]);
    await db.insert(emails).values([
      { ...mail, id: "invite-next" },
      { ...mail, id: "invite-past", status: "sent", sentAt: yesterday },
    ]);
    await db.insert(meetings).values([
      { id: "next", leadId: "a", startsAt: tomorrow, kind: "video", inviteEmailId: "invite-next" },
      { id: "past", leadId: "a", startsAt: yesterday, kind: "call" },
    ]);
  });

  it("refuses a won close without the deal and a person's lost close without a reason", async () => {
    await expect(closeConversation(db, "a", "closed", now, { userId: "u1" })).rejects.toThrow(
      WON_NEEDS_DEAL_MESSAGE,
    );
    await expect(closeConversation(db, "a", "discarded", now, { userId: "u1" })).rejects.toThrow(
      LOST_NEEDS_REASON_MESSAGE,
    );
    expect((await lead())?.status).toBe("replied");
    // An automatic close (no person) may still discard without a reason.
    await closeConversation(db, "a", "discarded", now, { automatic: true });
    expect((await lead())?.status).toBe("discarded");
  });

  it("refuses to mark a lead as closed from the panel without the deal", async () => {
    await expect(editLead(db, { id: "a", status: "closed" }, "u1", now)).rejects.toThrow(
      WON_NEEDS_DEAL_MESSAGE,
    );
  });

  it("closes once when two clicks race, with one won and one status event", async () => {
    const deal = { valueCents: 1000, closedOn: "2026-11-03", service: "Site" };
    const results = await Promise.allSettled([
      closeWonDeal(db, { id: "a", ...deal }, "u1", now),
      closeWonDeal(db, { id: "a", ...deal }, "u2", now),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const written = await events();
    expect(written.filter((event) => event.kind === "won")).toHaveLength(1);
    expect(written.filter((event) => event.kind === "status")).toHaveLength(1);
  });

  it("cancels the upcoming meetings and their queued invites, and undo brings them back", async () => {
    const { snapshot } = await closeWonDeal(
      db,
      { id: "a", valueCents: 1000, closedOn: "2026-11-03", service: "Site" },
      "u1",
      now,
    );
    expect(snapshot.cancelledMeetings).toEqual(["next"]);
    expect((await meeting("next"))?.cancelledAt).toEqual(now);
    expect((await meeting("past"))?.cancelledAt).toBeNull();
    expect((await email("invite-next"))?.status).toBe("cancelled");
    expect((await email("invite-past"))?.status).toBe("sent");

    await undoCloseConversation(db, "a", snapshot, { userId: "u1", now: later });
    expect((await meeting("next"))?.cancelledAt).toBeNull();
    expect((await email("invite-next"))?.status).toBe("queued");
  });

  it("cancels the meetings of a lead lost too, without opting it out", async () => {
    await closeLostDeal(db, { id: "a", reason: "price" }, "u1", now);
    expect((await meeting("next"))?.cancelledAt).toEqual(now);
    expect((await lead())?.unsubscribedAt).toBeNull();
  });

  it('opts the lead out on "Pediu para não ser contatado", blocking its address', async () => {
    const { snapshot } = await closeLostDeal(
      db,
      { id: "a", reason: "asked_no_contact" },
      "u1",
      now,
    );
    expect((await lead())?.unsubscribedAt).toEqual(now);
    expect(await addressUnsubscribed(db, "contato@loja.test")).toBe(true);
    // It never goes back to the queue: not by undo, not by the panel.
    await expect(undoCloseConversation(db, "a", snapshot)).rejects.toThrow(UNSUBSCRIBED_MESSAGE);
    await expect(editLead(db, { id: "a", status: "new" }, "u1", later)).rejects.toThrow(
      UNSUBSCRIBED_MESSAGE,
    );
  });

  it("changes the owner once when two people take the lead at the same time", async () => {
    const results = await Promise.allSettled([
      changeOwner(db, { id: "a", owner: "me" }, "u1", now),
      changeOwner(db, { id: "a", owner: "me" }, "u2", now),
    ]);
    const owners = (await events()).filter((event) => event.kind === "owner");
    // Each change that went through wrote one line, and each line starts where the last ended.
    expect(owners).toHaveLength(results.filter((result) => result.status === "fulfilled").length);
    expect(owners.map((event) => event.from)).toEqual([
      null,
      ...owners.slice(0, -1).map((event) => event.to),
    ]);
    expect((await lead())?.ownerId).toBe(owners.at(-1)?.to);
  });
});

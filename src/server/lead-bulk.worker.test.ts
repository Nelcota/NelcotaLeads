import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { emails, leadEvents, leads, meetings, searches, users } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { bulkUpdateLeads, undoBulkUpdate } from "./lead-bulk";

const db = getDb(env.DB);
const now = new Date("2026-10-12T15:00:00Z");

async function lead(id: string) {
  return db.query.leads.findFirst({ where: eq(leads.id, id) });
}

describe("bulkUpdateLeads", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
    await db.insert(leads).values([
      { id: "new", searchId: "s", placeId: "p1", name: "A" },
      {
        id: "contacted",
        searchId: "s",
        placeId: "p2",
        name: "B",
        status: "contacted",
        followUpOn: "2026-10-15",
      },
      { id: "closed", searchId: "s", placeId: "p3", name: "C", status: "closed" },
      {
        id: "gone",
        searchId: "s",
        placeId: "p4",
        name: "D",
        status: "discarded",
        unsubscribedAt: now,
        discardReason: "Pediu para sair",
      },
      {
        id: "ai",
        searchId: "s",
        placeId: "p5",
        name: "E",
        status: "discarded",
        discardReason: "Nota 10, abaixo do mínimo de 30",
        discardedAt: now,
      },
    ]);
  });

  it("changes only what the status rules allow and counts the rest", async () => {
    const result = await bulkUpdateLeads(
      db,
      ["new", "contacted", "closed", "missing"],
      "discarded",
    );
    expect(result).toMatchObject({ changed: 2, skipped: 2, notAllowed: 1, alreadyThere: 0 });
    expect(await lead("new")).toMatchObject({ status: "discarded" });
    expect(await lead("contacted")).toMatchObject({ status: "discarded", followUpOn: null });
    // closed → discarded is not a transition a person can make.
    expect(await lead("closed")).toMatchObject({ status: "closed" });
  });

  it("never sends an opted-out lead back to the queue", async () => {
    const result = await bulkUpdateLeads(db, ["gone", "ai"], "new", now);
    expect(result).toMatchObject({ changed: 1, skipped: 1 });
    expect(await lead("gone")).toMatchObject({ status: "discarded" });
    // A person moving the lead overrides the AI's triage.
    expect(await lead("ai")).toMatchObject({ status: "new", discardReason: null });
  });

  it("undoes a bulk discard, restoring each lead's own status", async () => {
    const { previous } = await bulkUpdateLeads(db, ["new", "contacted"], "discarded", now);
    expect(await undoBulkUpdate(db, "discarded", previous)).toEqual({ restored: 2 });
    expect(await lead("new")).toMatchObject({ status: "new" });
    expect(await lead("contacted")).toMatchObject({
      status: "contacted",
      followUpOn: "2026-10-15",
    });
  });

  it("undo brings back a lost deal's reason, note, date and stage", async () => {
    await db.insert(leads).values({
      id: "lost",
      searchId: "s",
      placeId: "p6",
      name: "F",
      status: "discarded",
      salesStage: "proposal",
      lossReason: "price",
      lossNote: "Achou caro",
      lostAt: now,
      discardReason: "Preço alto",
      discardedAt: now,
    });
    const { previous } = await bulkUpdateLeads(db, ["lost"], "new", now);
    expect(await lead("lost")).toMatchObject({ status: "new", lossReason: null, salesStage: null });
    expect(await undoBulkUpdate(db, "new", previous)).toEqual({ restored: 1 });
    expect(await lead("lost")).toMatchObject({
      status: "discarded",
      salesStage: "proposal",
      lossReason: "price",
      lossNote: "Achou caro",
      lostAt: now,
      discardReason: "Preço alto",
      discardedAt: now,
    });
  });

  it("leaves alone leads that moved or opted out since the bulk change", async () => {
    const { previous } = await bulkUpdateLeads(db, ["new", "contacted"], "discarded", now);
    await db.update(leads).set({ status: "new" }).where(eq(leads.id, "new"));
    await db.update(leads).set({ unsubscribedAt: now }).where(eq(leads.id, "contacted"));
    expect(await undoBulkUpdate(db, "discarded", previous)).toEqual({ restored: 0 });
    expect(await lead("contacted")).toMatchObject({ status: "discarded" });
  });

  it("says why leads did not move: already there, not allowed or in conversation", async () => {
    await db.insert(leads).values({
      id: "talking",
      searchId: "s",
      placeId: "p7",
      name: "G",
      status: "replied",
    });
    const result = await bulkUpdateLeads(db, ["ai", "closed", "talking", "missing"], "discarded");
    expect(result).toMatchObject({
      changed: 0,
      skipped: 4,
      alreadyThere: 1,
      notAllowed: 1,
      needsReason: 1,
      changedMeanwhile: 0,
      gone: 1,
    });
    // A conversation ends through the panel, with the loss reason the metrics count.
    expect(await lead("talking")).toMatchObject({ status: "replied" });
  });

  it("writes each change to the history and the undo writes the way back", async () => {
    await db
      .insert(users)
      .values({ id: "u1", name: "Haniel", email: "haniel@nelcota.test", passwordHash: "x" });
    const { previous } = await bulkUpdateLeads(db, ["new"], "contacted", now, "u1");
    const afterChange = await db.select().from(leadEvents).where(eq(leadEvents.leadId, "new"));
    expect(afterChange).toEqual([
      expect.objectContaining({
        kind: "status",
        fromValue: "new",
        toValue: "contacted",
        userId: "u1",
      }),
    ]);
    await undoBulkUpdate(db, "contacted", previous, now, "u1");
    const afterUndo = await db.select().from(leadEvents).where(eq(leadEvents.leadId, "new"));
    expect(afterUndo.map((event) => `${event.fromValue}>${event.toValue}`).toSorted()).toEqual([
      "contacted>new",
      "new>contacted",
    ]);
  });

  it("cancels the future meetings of a discarded lead", async () => {
    await db.insert(meetings).values({
      id: "m1",
      leadId: "contacted",
      startsAt: new Date("2026-10-13T15:00:00Z"),
      kind: "call",
    });
    await bulkUpdateLeads(db, ["contacted"], "discarded", now);
    const meeting = await db.query.meetings.findFirst({ where: eq(meetings.id, "m1") });
    expect(meeting?.cancelledAt).not.toBeNull();
  });

  it("undo restores only meetings and queued invites cancelled by that bulk action", async () => {
    const invite = {
      id: "invite-1",
      leadId: "contacted",
      direction: "out" as const,
      status: "queued" as const,
      author: "user" as const,
      fromAddress: "team@nelcota.test",
      toAddress: "lead@nelcota.test",
      subject: "Meeting",
      body: "See you there",
    };
    await db.insert(emails).values(invite);
    await db.insert(meetings).values({
      id: "meeting-1",
      leadId: "contacted",
      startsAt: new Date("2026-10-13T15:00:00Z"),
      kind: "call",
      inviteEmailId: invite.id,
    });
    const { previous } = await bulkUpdateLeads(db, ["contacted"], "discarded", now);
    expect(previous[0]?.cancelledMeetings).toEqual(["meeting-1"]);
    expect((await db.query.emails.findFirst({ where: eq(emails.id, invite.id) }))?.status).toBe(
      "cancelled",
    );
    await undoBulkUpdate(db, "discarded", previous, now);
    expect(
      (await db.query.meetings.findFirst({ where: eq(meetings.id, "meeting-1") }))?.cancelledAt,
    ).toBeNull();
    expect((await db.query.emails.findFirst({ where: eq(emails.id, invite.id) }))?.status).toBe(
      "queued",
    );
  });

  it("forgets the contact date when a lead goes back to the queue, and the undo restores it", async () => {
    const contactedAt = new Date("2026-10-01T12:00:00Z");
    await db.update(leads).set({ contactedAt }).where(eq(leads.id, "contacted"));
    const { previous } = await bulkUpdateLeads(db, ["contacted"], "new", now);
    expect(await lead("contacted")).toMatchObject({ status: "new", contactedAt: null });
    await undoBulkUpdate(db, "new", previous, now);
    expect(await lead("contacted")).toMatchObject({ status: "contacted", contactedAt });
  });

  it("handles more leads than D1 binds in one query", async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({
      id: `m${i}`,
      searchId: "s",
      placeId: `pm${i}`,
      name: `M${i}`,
    }));
    for (let i = 0; i < many.length; i += 10) {
      await db.insert(leads).values(many.slice(i, i + 10));
    }
    const result = await bulkUpdateLeads(
      db,
      many.map((row) => row.id),
      "discarded",
    );
    expect(result).toMatchObject({ changed: 150, skipped: 0 });
  });
});

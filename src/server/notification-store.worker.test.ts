import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { emails, leads, meetings, notificationReads, searches, users } from "@/db/schema";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notifications";
import { resetDb } from "../../test/reset-db";
import {
  dismissNotifications,
  loadNotificationPrefs,
  loadNotifications,
  markLeadRepliesRead,
  markNotificationsRead,
  restoreNotifications,
  storeNotificationPrefs,
} from "./notification-store";

const db = getDb(env.DB);
// 07/11/2026 15:00 in Brazil.
const now = new Date("2026-11-07T18:00:00Z");
const minutes = (count: number) => new Date(now.getTime() + count * 60_000);

const USER = { id: "u1", name: "Haniel", email: "haniel@example.com", passwordHash: "x" };
const OTHER = { id: "u2", name: "Phellipe", email: "phellipe@example.com", passwordHash: "x" };

async function seed() {
  await db.insert(users).values([USER, OTHER]);
  await db.insert(searches).values({
    id: "s1",
    niche: "dentistas",
    city: "Belo Horizonte",
    maxResults: 20,
    status: "done",
    foundCount: 6,
    createdAt: minutes(-120),
  });
  await db.insert(leads).values([
    {
      id: "l1",
      placeId: "p1",
      searchId: "s1",
      name: "Odonto Sorriso BH",
      ownerId: "u1",
      status: "replied",
    },
    {
      id: "l2",
      placeId: "p2",
      searchId: "s1",
      name: "Barbearia Dom Bigode",
      ownerId: "u2",
      status: "contacted",
      followUpOn: "2026-11-05",
    },
  ]);
}

function reply(
  id: string,
  leadId: string,
  at: Date,
  extra: Partial<typeof emails.$inferInsert> = {},
) {
  return {
    id,
    leadId,
    direction: "in" as const,
    status: "received" as const,
    author: "lead" as const,
    fromAddress: "lead@example.com",
    toAddress: "equipe@example.com",
    subject: "Re: site",
    body: "Pode me mandar valores?\n\nEm 05/11, Equipe escreveu:\n> Olá",
    sentAt: at,
    createdAt: at,
    ...extra,
  };
}

describe("notification store", () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
  });

  it("lists unread replies without the quoted original, and skips auto-replies", async () => {
    await db
      .insert(emails)
      .values([
        reply("e1", "l1", minutes(-5)),
        reply("e2", "l1", minutes(-4), { automatic: true }),
      ]);
    const items = await loadNotifications(db, "u1", now);
    const replies = items.filter((item) => item.category === "replies");
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({
      key: "reply:e1",
      text: "“Pode me mandar valores?”",
      unread: true,
      ownerId: "u1",
      href: { to: "/conversas", search: { lead: "l1" } },
    });
  });

  it("reads a reply for the whole team, and opening the conversation reads it too", async () => {
    await db
      .insert(emails)
      .values([reply("e1", "l1", minutes(-5)), reply("e3", "l1", minutes(-3))]);
    await markNotificationsRead(db, "u2", ["reply:e1"], now);
    const forHaniel = await loadNotifications(db, "u1", now);
    expect(forHaniel.find((item) => item.key === "reply:e1")?.unread).toBe(false);
    expect(forHaniel.find((item) => item.key === "reply:e3")?.unread).toBe(true);

    await markLeadRepliesRead(db, "l1", now);
    const after = await loadNotifications(db, "u1", now);
    expect(after.filter((item) => item.category === "replies" && item.unread)).toHaveLength(0);
  });

  it("marks an overdue follow-up, and reads it per person", async () => {
    const items = await loadNotifications(db, "u1", now);
    const followUp = items.find((item) => item.key === "followup:l2:2026-11-05");
    expect(followUp).toMatchObject({ warning: "Atrasado 2 dias", day: "2026-11-05", unread: true });

    await markNotificationsRead(db, "u1", ["followup:l2:2026-11-05"], now);
    const mine = await loadNotifications(db, "u1", now);
    const theirs = await loadNotifications(db, "u2", now);
    expect(mine.find((item) => item.key === "followup:l2:2026-11-05")?.unread).toBe(false);
    expect(theirs.find((item) => item.key === "followup:l2:2026-11-05")?.unread).toBe(true);
  });

  it("gives a meeting about to start its own notification", async () => {
    await db.insert(meetings).values([
      { id: "m1", leadId: "l1", startsAt: minutes(10), kind: "video", createdBy: "u1" },
      { id: "m2", leadId: "l1", startsAt: minutes(120), kind: "call", createdBy: "u1" },
    ]);
    const items = await loadNotifications(db, "u1", now);
    const agenda = items.filter((item) => item.category === "agenda");
    expect(agenda.map((item) => item.key.split(":")[0]).toSorted()).toEqual([
      "meeting",
      "meeting-soon",
    ]);
    expect(agenda.find((item) => item.key.startsWith("meeting-soon"))).toMatchObject({
      text: "Videochamada às 15:10",
      dueAt: minutes(10).getTime(),
      href: { to: "/agenda", search: { view: "dia", date: "2026-11-07" } },
    });
  });

  it("lists finished searches for everyone", async () => {
    const items = await loadNotifications(db, "u2", now);
    expect(items.find((item) => item.category === "searches")).toMatchObject({
      title: "Dentistas em Belo Horizonte",
      text: "6 leads novos",
      ownerId: null,
    });
  });

  it("clears notifications for one person only, and a cleared reply stays unread for the team", async () => {
    await db.insert(emails).values(reply("e1", "l1", minutes(-5)));
    await markNotificationsRead(db, "u1", ["search:s1"], now);
    await dismissNotifications(db, "u1", ["reply:e1", "search:s1"], now);

    const mine = await loadNotifications(db, "u1", now);
    expect(mine.map((item) => item.key)).not.toContain("reply:e1");
    expect(mine.map((item) => item.key)).not.toContain("search:s1");

    const theirs = await loadNotifications(db, "u2", now);
    expect(theirs.find((item) => item.key === "reply:e1")?.unread).toBe(true);
    expect(theirs.find((item) => item.key === "search:s1")).toBeDefined();
  });

  it("brings cleared notifications back as they were with Desfazer", async () => {
    await markNotificationsRead(db, "u1", ["followup:l2:2026-11-05"], now);
    const keys = ["search:s1", "followup:l2:2026-11-05"];
    await dismissNotifications(db, "u1", keys, now);
    await restoreNotifications(db, "u1", keys, ["search:s1"]);
    const items = await loadNotifications(db, "u1", now);
    expect(items.find((item) => item.key === "search:s1")?.unread).toBe(true);
    expect(items.find((item) => item.key === "followup:l2:2026-11-05")?.unread).toBe(false);
  });

  it("shows a reply waiting more than a day once, as the late alert", async () => {
    await db
      .update(leads)
      .set({ aiMode: false, lastEmailAt: minutes(-30 * 60) })
      .where(eq(leads.id, "l1"));
    await db.insert(emails).values(reply("e1", "l1", minutes(-30 * 60)));
    const items = await loadNotifications(db, "u1", now);
    const forLead = items.filter((item) => item.title === "Odonto Sorriso BH");
    expect(forLead.map((item) => item.key.split(":")[0])).toEqual(["late"]);
    expect(forLead[0]?.warning).toBe("Sem resposta há 30 h");
    expect(forLead[0]).not.toHaveProperty("leadId");
  });

  it("stores the preferences and falls back to the defaults", async () => {
    expect(await loadNotificationPrefs(db, "u1")).toEqual(DEFAULT_NOTIFICATION_PREFS);
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, scope: "all" as const };
    await storeNotificationPrefs(db, "u1", prefs);
    expect(await loadNotificationPrefs(db, "u1")).toEqual(prefs);
  });

  it("marks many keys at once without hitting the bound-value limit", async () => {
    const keys = Array.from({ length: 120 }, (_, index) => `search:s${index}`);
    await markNotificationsRead(db, "u1", keys, now);
    await markNotificationsRead(db, "u1", keys, now);
    await dismissNotifications(db, "u1", keys, now);
    const rows = await db.select().from(notificationReads);
    expect(rows).toHaveLength(120);
    expect(rows.every((row) => row.dismissedAt !== null)).toBe(true);
  });
});

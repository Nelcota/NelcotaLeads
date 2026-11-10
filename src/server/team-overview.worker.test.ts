import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { leadEvents, leads, meetings, monthlyGoals, proposals, searches, users } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import { assignLeads } from "./lead-assign-store";
import { changeOwner, MEMBER_NOT_FOUND_MESSAGE } from "./lead-deal";
import { queryLeads } from "./leads-query";
import { freeLeadIds } from "./team-free-store";
import { teamOverview } from "./team-overview";

const db = getDb(env.DB);
// Sunday 08/11/2026, 15:00 in Brazil.
const now = new Date("2026-11-08T18:00:00Z");
const earlier = new Date("2026-11-05T15:00:00Z");
const lastMonth = new Date("2026-10-20T15:00:00Z");

const ownerOf = async (id: string) =>
  (await db.query.leads.findFirst({ where: eq(leads.id, id), columns: { ownerId: true } }))
    ?.ownerId;

describe("Equipe", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(users).values([
      {
        id: "u1",
        name: "Haniel",
        email: "haniel@nelcota.test",
        passwordHash: "x",
        createdAt: earlier,
      },
      {
        id: "u2",
        name: "Phellipe",
        email: "phellipe@nelcota.test",
        passwordHash: "x",
        createdAt: now,
      },
    ]);
    await db.insert(searches).values({ id: "s", niche: "x", city: "y", maxResults: 1 });
    await db.insert(leads).values([
      {
        id: "a",
        placeId: "a",
        name: "A",
        searchId: "s",
        ownerId: "u1",
        status: "replied",
        aiMode: false,
      },
      {
        id: "b",
        placeId: "b",
        name: "B",
        searchId: "s",
        ownerId: "u1",
        status: "contacted",
        followUpOn: "2026-11-08",
      },
      {
        id: "c",
        placeId: "c",
        name: "C",
        searchId: "s",
        ownerId: "u1",
        status: "contacted",
        followUpOn: "2026-11-05",
      },
      {
        id: "d",
        placeId: "d",
        name: "D",
        searchId: "s",
        ownerId: "u1",
        status: "closed",
        closedAt: earlier,
        dealValueCents: 240000,
      },
      {
        id: "e",
        placeId: "e",
        name: "E",
        searchId: "s",
        ownerId: "u1",
        status: "closed",
        closedAt: lastMonth,
        dealValueCents: 100000,
      },
      { id: "f", placeId: "f", name: "F", searchId: "s", status: "new" },
      { id: "g", placeId: "g", name: "G", searchId: "s", status: "discarded" },
    ]);
  });

  it("counts each partner's leads, deals, meetings, proposals and today", async () => {
    await db.insert(meetings).values({
      id: "m",
      leadId: "a",
      startsAt: new Date("2026-11-09T13:00:00Z"),
      kind: "video",
      createdBy: "u1",
      createdAt: earlier,
    });
    await db.insert(proposals).values({
      id: "p",
      leadId: "a",
      items: [],
      totalCents: 310000,
      createdBy: "u1",
      createdAt: earlier,
    });
    await db.insert(monthlyGoals).values({ month: "2026-11", deals: 10, revenueCents: 2500000 });
    const team = await teamOverview(db, "month", now);
    const haniel = team.members.find((member) => member.id === "u1");
    expect(haniel).toMatchObject({
      held: 3,
      talking: 1,
      meetings: 1,
      proposals: 1,
      won: { deals: 1, revenueCents: 240000 },
      previousDeals: 1,
      today: { due: 1, late: 1, waiting: 1, nextMeeting: { leadId: "a", leadName: "A" } },
    });
    expect(team.members.find((member) => member.id === "u2")).toMatchObject({
      held: 0,
      won: { deals: 0 },
    });
    // Only contacted or replied leads count as free; the new one waits for the dispatch.
    expect(team.free).toMatchObject({ total: 0, newCount: 1, leads: [] });
    expect(team.goal.progress).toEqual({ deals: 1, revenueCents: 240000 });
  });

  it("credits a deal to who closed it, even after the lead changed owner", async () => {
    await db.insert(leadEvents).values({
      id: "w",
      leadId: "d",
      kind: "won",
      toValue: "240000",
      userId: "u2",
      createdAt: earlier,
    });
    const team = await teamOverview(db, "month", now);
    expect(team.members.find((member) => member.id === "u2")?.won).toEqual({
      deals: 1,
      revenueCents: 240000,
    });
    expect(team.members.find((member) => member.id === "u1")?.won.deals).toBe(0);
  });

  it("lists free leads that need someone and splits only those", async () => {
    await db.update(leads).set({ ownerId: null }).where(eq(leads.id, "b"));
    const team = await teamOverview(db, "month", now);
    expect(team.free).toMatchObject({ total: 1, newCount: 1, leads: [{ id: "b" }] });
    expect(await freeLeadIds(db)).toEqual(["b"]);
  });

  it("lists the team's activity of the period, without plain status changes", async () => {
    await db.insert(leadEvents).values([
      { id: "1", leadId: "a", kind: "owner", toValue: "u1", userId: "u1", createdAt: earlier },
      {
        id: "2",
        leadId: "a",
        kind: "status",
        toValue: "replied",
        userId: "u1",
        createdAt: earlier,
      },
      { id: "3", leadId: "d", kind: "won", toValue: "240000", userId: "u1", createdAt: lastMonth },
    ]);
    const team = await teamOverview(db, "month", now);
    expect(team.activity.map((event) => event.id)).toEqual(["1"]);
  });

  it("hands a free lead to a partner, and not one someone took meanwhile", async () => {
    const moved = await assignLeads(db, [{ id: "f", owner: "u2", expected: null }], "u1", now);
    expect(moved).toHaveLength(1);
    expect(await ownerOf("f")).toBe("u2");
    expect(await assignLeads(db, [{ id: "f", owner: "u1", expected: null }], "u1", now)).toEqual(
      [],
    );
    expect(await ownerOf("f")).toBe("u2");
    const owned = await db.select().from(leadEvents).where(eq(leadEvents.leadId, "f"));
    expect(owned).toMatchObject([{ kind: "owner", fromValue: null, toValue: "u2", userId: "u1" }]);
  });

  it("refuses someone who is not in the team", async () => {
    await expect(
      assignLeads(db, [{ id: "f", owner: "nobody", expected: null }], "u1", now),
    ).rejects.toThrow(MEMBER_NOT_FOUND_MESSAGE);
    await expect(changeOwner(db, { id: "f", owner: "nobody" }, "u1", now)).rejects.toThrow(
      MEMBER_NOT_FOUND_MESSAGE,
    );
    await changeOwner(db, { id: "f", owner: "u2" }, "u1", now);
    expect(await ownerOf("f")).toBe("u2");
  });

  it("filters Leads by owner, by nobody and by stage", async () => {
    await db.update(leads).set({ salesStage: "proposal" }).where(eq(leads.id, "a"));
    const ids = async (filters: Parameters<typeof queryLeads>[1]) =>
      (await queryLeads(db, filters, "2026-11-08", 50, now)).map((row) => row.id).toSorted();
    expect(await ids({ owner: "u1", view: "talking" })).toEqual(["a"]);
    expect(await ids({ owner: "none" })).toEqual(["f", "g"]);
    expect(await ids({ stage: "proposal" })).toEqual(["a"]);
  });
});

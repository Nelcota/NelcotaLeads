import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { invites, users } from "@/db/schema";
import {
  ALREADY_INVITED_MESSAGE,
  ALREADY_MEMBER_MESSAGE,
  INVITE_NOT_FOUND_MESSAGE,
} from "@/lib/team";
import { resetDb } from "../../test/reset-db";
import { attemptSignUp } from "./auth";
import { createInvite, pendingInviteEmail, pendingInvites, removeInvite } from "./team-store";

const db = getDb(env.DB);
const SECRET = "correct horse battery";
const now = new Date("2026-11-03T17:00:00Z");

const signUp = (email: string, inviteOnly?: boolean) =>
  attemptSignUp(
    { db, secret: SECRET, ip: "203.0.113.7", inviteOnly },
    { name: "Bia", email, password: "senha-da-bia", accessCode: SECRET },
    now,
  );

const inviteOf = (email: string) => db.query.invites.findFirst({ where: eq(invites.email, email) });

describe("team", () => {
  beforeEach(async () => {
    await resetDb();
    await db.insert(users).values({
      id: "u1",
      name: "Haniel",
      email: "haniel@nelcota.test",
      passwordHash: "x",
    });
  });

  it("reads a pending invite's address for Reenviar and refuses a used one", async () => {
    const invite = await createInvite(db, "bia@nelcota.test", "u1", now);
    expect(await pendingInviteEmail(db, invite.id)).toBe("bia@nelcota.test");
    await db.update(invites).set({ acceptedAt: now }).where(eq(invites.id, invite.id));
    await expect(pendingInviteEmail(db, invite.id)).rejects.toThrow(INVITE_NOT_FOUND_MESSAGE);
  });

  it("stores an invite and refuses a duplicate or a member", async () => {
    const invite = await createInvite(db, "bia@nelcota.test", "u1", now);
    expect(invite.email).toBe("bia@nelcota.test");
    await expect(createInvite(db, "bia@nelcota.test", "u1", now)).rejects.toThrow(
      ALREADY_INVITED_MESSAGE,
    );
    await expect(createInvite(db, "haniel@nelcota.test", "u1", now)).rejects.toThrow(
      ALREADY_MEMBER_MESSAGE,
    );
    expect(await pendingInvites(db)).toEqual([
      { id: invite.id, email: "bia@nelcota.test", createdAt: now },
    ]);
  });

  it("removes a pending invite, once", async () => {
    const invite = await createInvite(db, "bia@nelcota.test", "u1", now);
    await removeInvite(db, invite.id);
    expect(await pendingInvites(db)).toEqual([]);
    await expect(removeInvite(db, invite.id)).rejects.toThrow(INVITE_NOT_FOUND_MESSAGE);
  });

  it("marks the invite accepted when that e-mail creates an account", async () => {
    await createInvite(db, "bia@nelcota.test", "u1", now);
    expect((await signUp("bia@nelcota.test")).ok).toBe(true);
    expect((await inviteOf("bia@nelcota.test"))?.acceptedAt).toEqual(now);
    expect(await pendingInvites(db)).toEqual([]);
  });

  it("renews an accepted invite whose account was removed", async () => {
    await createInvite(db, "bia@nelcota.test", "u1", now);
    await signUp("bia@nelcota.test");
    await db.delete(users).where(eq(users.email, "bia@nelcota.test"));
    const renewed = await createInvite(db, "bia@nelcota.test", "u1", now);
    expect(await pendingInvites(db)).toEqual([
      { id: renewed.id, email: "bia@nelcota.test", createdAt: now },
    ]);
  });

  it("lets anyone with the access code sign up while INVITE_ONLY_SIGNUP is off", async () => {
    expect((await signUp("nova@nelcota.test")).ok).toBe(true);
    expect((await signUp("outra@nelcota.test", false)).ok).toBe(true);
  });

  it("with INVITE_ONLY_SIGNUP on, signs up only invited e-mails", async () => {
    expect(await signUp("nova@nelcota.test", true)).toMatchObject({
      ok: false,
      status: 403,
      code: "sem-convite",
    });
    expect(
      await db.query.users.findFirst({ where: eq(users.email, "nova@nelcota.test") }),
    ).toBeUndefined();
    await createInvite(db, "nova@nelcota.test", "u1", now);
    expect((await signUp("nova@nelcota.test", true)).ok).toBe(true);
    expect((await inviteOf("nova@nelcota.test"))?.acceptedAt).toEqual(now);
  });

  it("with INVITE_ONLY_SIGNUP on, still lets the very first account in", async () => {
    await db.delete(users);
    expect((await signUp("primeira@nelcota.test", true)).ok).toBe(true);
  });
});

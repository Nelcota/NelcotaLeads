import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import {
  ACCESS_CODE_FAILURES_PER_DAY,
  FAILURES_PER_ACCOUNT,
  FAILURES_PER_ADDRESS,
  SESSION_COOKIE,
  attemptLogin,
  attemptPasswordReset,
  attemptSignUp,
  readSession,
  sessionVersionLookup,
} from "./auth";

const db = getDb(env.DB);
const SECRET = "correct horse battery";
const now = new Date("2026-10-11T12:00:00Z");
const tomorrow = new Date("2026-10-12T12:00:00Z");
// `now` starts a 15-minute window; this is the start of the next one.
const nextWindow = new Date("2026-10-11T12:15:00Z");
const ACCOUNT = { name: "Ana", email: "ana@nelcota.test", password: "senha-da-ana" };

const deps = (ip = "203.0.113.7") => ({ db, secret: SECRET, ip });
// Every attempt runs a deliberately slow password hash, so the limit tests take a while.
const SLOW = { timeout: 60_000 };

const signUp = (overrides: Partial<typeof ACCOUNT & { accessCode: string }> = {}, ip?: string) =>
  attemptSignUp(deps(ip), { ...ACCOUNT, accessCode: SECRET, ...overrides }, now);

const login = (password: string, ip?: string, at = now, email = ACCOUNT.email) =>
  attemptLogin(deps(ip), { email, password }, at);

/** The session a Set-Cookie header would give, as the gate would read it. */
async function sessionOf(cookie: string) {
  const token = cookie.split(";")[0] ?? "";
  const request = new Request("https://app.test/", { headers: { Cookie: token } });
  return readSession(request, SECRET, sessionVersionLookup(db), now);
}

describe("attemptSignUp", () => {
  beforeEach(resetDb);

  it("creates the account, stores only a hash and signs it in", async () => {
    const result = await signUp();
    expect(result.ok && result.cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=[\\w-]+\\.1\\.`));
    const row = await db.query.users.findFirst({ where: eq(users.email, ACCOUNT.email) });
    expect(row).toMatchObject({ name: "Ana", sessionVersion: 1 });
    expect(row?.passwordHash).not.toContain(ACCOUNT.password);
    expect(result.ok && (await sessionOf(result.cookie))?.userId).toBe(row?.id);
  });

  it("refuses a wrong access code and creates nothing", async () => {
    expect(await signUp({ accessCode: "wrong code" })).toMatchObject({
      ok: false,
      status: 401,
      code: "codigo",
    });
    expect(await db.query.users.findMany()).toHaveLength(0);
  });

  it("refuses a second account with the same e-mail", async () => {
    await signUp();
    expect(await signUp({ name: "Outra" })).toMatchObject({ status: 409, code: "email-em-uso" });
  });

  it("counts wrong access codes toward the address limit", SLOW, async () => {
    for (let i = 0; i < FAILURES_PER_ADDRESS; i++) await signUp({ accessCode: "nope" });
    expect(await signUp()).toMatchObject({ status: 429, code: "limite" });
  });

  it("closes sign-up for the day after too many wrong codes from anywhere", SLOW, async () => {
    for (let i = 0; i < ACCESS_CODE_FAILURES_PER_DAY; i++) {
      await signUp({ accessCode: "nope" }, `198.51.100.${i}`);
    }
    expect(await signUp({}, "192.0.2.1")).toMatchObject({
      status: 429,
      error: "Muitas tentativas erradas hoje. Tente de novo amanhã.",
    });
    // It opens again the next day.
    const reopened = await attemptSignUp(
      deps("192.0.2.1"),
      { ...ACCOUNT, accessCode: SECRET },
      tomorrow,
    );
    expect(reopened.ok).toBe(true);
  });

  it("fails closed without a configured secret", async () => {
    const result = await attemptSignUp(
      { db, secret: undefined, ip: "x" },
      { ...ACCOUNT, accessCode: "" },
      now,
    );
    expect(result).toMatchObject({ ok: false, status: 503, code: "config" });
  });
});

describe("attemptLogin", () => {
  beforeEach(async () => {
    await resetDb();
    await signUp();
  });

  it("returns a session cookie for the right e-mail and password", async () => {
    expect((await login(ACCOUNT.password)).ok).toBe(true);
  });

  it("gives the same answer for a wrong password and an unknown e-mail", async () => {
    const wrong = await login("nope");
    const unknown = await login(ACCOUNT.password, undefined, now, "ninguem@nelcota.test");
    expect(wrong).toMatchObject({ ok: false, status: 401, code: "senha" });
    expect(unknown).toEqual(wrong);
  });

  it("locks an address out for 15 minutes, saying how long is left", SLOW, async () => {
    for (let i = 0; i < FAILURES_PER_ADDRESS; i++) await login("nope");
    expect(await login(ACCOUNT.password)).toMatchObject({
      ok: false,
      status: 429,
      code: "limite",
      error: "Muitas tentativas erradas. Tente de novo em 15 minutos.",
    });
    expect((await login(ACCOUNT.password, "198.51.100.1")).ok).toBe(true);
    expect((await login(ACCOUNT.password, "203.0.113.7", nextWindow)).ok).toBe(true);
  });

  it("counts every address of one IPv6 /64 together", SLOW, async () => {
    for (let i = 0; i < FAILURES_PER_ADDRESS; i++) {
      await login("nope", `2001:db8:1:2::${i + 1}`);
    }
    expect(await login(ACCOUNT.password, "2001:db8:1:2:ffff::1")).toMatchObject({ status: 429 });
    expect((await login(ACCOUNT.password, "2001:db8:1:3::1")).ok).toBe(true);
  });

  it(
    "an attack from many addresses locks only that account, and only for the window",
    SLOW,
    async () => {
      await signUp({ name: "Bia", email: "bia@nelcota.test", password: "senha-da-bia" });
      for (let i = 0; i < FAILURES_PER_ACCOUNT; i++) await login("nope", `198.51.100.${i}`);
      // The attacked account waits out the window, from any address...
      expect(await login(ACCOUNT.password, "192.0.2.1")).toMatchObject({ status: 429 });
      // ...while everyone else signs in as usual, and the owner gets back in 15 minutes later.
      expect((await login("senha-da-bia", "192.0.2.1", now, "bia@nelcota.test")).ok).toBe(true);
      expect((await login(ACCOUNT.password, "192.0.2.1", nextWindow)).ok).toBe(true);
    },
  );

  it(
    "counts parallel attempts before comparing, so bursts can't exceed the limit",
    SLOW,
    async () => {
      const results = await Promise.all(
        Array.from({ length: FAILURES_PER_ADDRESS + 5 }, () => login("nope")),
      );
      expect(results.filter((result) => !result.ok && result.status === 401)).toHaveLength(
        FAILURES_PER_ADDRESS,
      );
    },
  );

  it("does not count successful logins as failures", SLOW, async () => {
    for (let i = 0; i < FAILURES_PER_ADDRESS + 2; i++) {
      expect((await login(ACCOUNT.password)).ok).toBe(true);
    }
  });

  it("fails closed without a configured secret", async () => {
    const result = await attemptLogin(
      { db, secret: undefined, ip: "x" },
      { email: ACCOUNT.email, password: ACCOUNT.password },
      now,
    );
    expect(result).toMatchObject({ ok: false, status: 503, code: "config" });
  });
});

describe("attemptPasswordReset", () => {
  beforeEach(resetDb);

  it("sets the new password and signs out the account's other sessions", async () => {
    const first = await signUp();
    if (!first.ok) throw new Error("sign-up failed");

    const reset = await attemptPasswordReset(
      deps(),
      { email: ACCOUNT.email, password: "senha-nova-123", accessCode: SECRET },
      now,
    );
    expect(reset.ok).toBe(true);
    expect(await sessionOf(first.cookie)).toBeNull();
    expect(reset.ok && (await sessionOf(reset.cookie))).not.toBeNull();
    expect((await login(ACCOUNT.password)).ok).toBe(false);
    expect((await login("senha-nova-123")).ok).toBe(true);
  });

  it("refuses a wrong access code and keeps the old password", async () => {
    await signUp();
    const result = await attemptPasswordReset(
      deps(),
      { email: ACCOUNT.email, password: "senha-nova-123", accessCode: "nope" },
      now,
    );
    expect(result).toMatchObject({ status: 401, code: "codigo" });
    expect((await login(ACCOUNT.password)).ok).toBe(true);
  });

  it("says so when there is no account with that e-mail", async () => {
    const result = await attemptPasswordReset(
      deps(),
      { email: "ninguem@nelcota.test", password: "senha-nova-123", accessCode: SECRET },
      now,
    );
    expect(result).toMatchObject({ status: 404, code: "sem-conta" });
  });
});

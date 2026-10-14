import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { apiUsage, users } from "@/db/schema";
import { resetDb } from "../../test/reset-db";
import {
  ACCESS_CODE_FAILURES_PER_DAY,
  FAILURES_PER_ACCOUNT,
  FAILURES_PER_ADDRESS,
  RESET_MAILS_PER_ACCOUNT,
  RESET_REQUESTS_PER_ADDRESS,
  SESSION_COOKIE,
  attemptLogin,
  attemptPasswordReset,
  attemptSignUp,
  readSession,
  requestPasswordReset,
  signOut,
  sessionLookup,
  type ResetMailer,
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
async function sessionOf(cookie: string | null) {
  const token = cookie?.split(";")[0] ?? "";
  const request = new Request("https://app.test/", { headers: { Cookie: token } });
  return readSession(request, SECRET, sessionLookup(db), now);
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

  it("keeps no per-account counter for e-mails without an account", async () => {
    await login("nope", undefined, now, "ninguem@nelcota.test");
    const counters = await db.select({ key: apiUsage.provider }).from(apiUsage);
    expect(counters.filter(({ key }) => key.startsWith("login-account:"))).toEqual([]);
  });

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

/** Asks for a link and returns the ones "sent" (captured instead of mailed). */
async function askLink(email = ACCOUNT.email, ip?: string, at = now) {
  const sent: string[] = [];
  const send: ResetMailer = async ({ link }) => void sent.push(link);
  const result = await requestPasswordReset(
    { ...deps(ip), origin: "https://app.test", send },
    { email },
    at,
  );
  return { result, sent };
}
const tokenOf = (link: string | undefined) => new URL(link ?? "").searchParams.get("token") ?? "";
const reset = (token: string, password = "senha-nova-123", at = now) =>
  attemptPasswordReset(deps(), { token, password }, at);

describe("password reset by e-mail", () => {
  beforeEach(resetDb);

  it("mails a link that sets the new password and signs out the other sessions", async () => {
    const first = await signUp();
    const { result, sent } = await askLink();
    expect(result).toMatchObject({ ok: true, cookie: null });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatch(/^https:\/\/app\.test\/redefinir-senha\?token=/);

    const done = await reset(tokenOf(sent[0]));
    expect(done.ok).toBe(true);
    expect(await sessionOf(first.ok ? first.cookie : null)).toBeNull();
    expect(done.ok && (await sessionOf(done.cookie))).not.toBeNull();
    expect((await login(ACCOUNT.password)).ok).toBe(false);
    expect((await login("senha-nova-123")).ok).toBe(true);
  });

  it("answers the same for an unknown e-mail and sends nothing", async () => {
    await signUp();
    const known = await askLink();
    const unknown = await askLink("ninguem@nelcota.test");
    expect(unknown.result).toEqual(known.result);
    expect(unknown.sent).toHaveLength(0);
  });

  it("works once, and not after an hour", async () => {
    await signUp();
    const { sent } = await askLink();
    const token = tokenOf(sent[0]);
    expect((await reset(token)).ok).toBe(true);
    expect(await reset(token, "outra-senha-456")).toMatchObject({ code: "link-invalido" });

    const later = await askLink();
    const expired = await reset(tokenOf(later.sent[0]), "outra-senha-456", tomorrow);
    expect(expired).toMatchObject({ status: 401, code: "link-invalido" });
    expect((await login("senha-nova-123")).ok).toBe(true);
  });

  it("refuses a forged or tampered token", async () => {
    await signUp();
    const { sent } = await askLink();
    const token = tokenOf(sent[0]);
    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    for (const forged of [tampered, "garbage", ""]) {
      expect(await reset(forged)).toMatchObject({ ok: false, code: "link-invalido" });
    }
    expect((await login(ACCOUNT.password)).ok).toBe(true);
  });

  it("limits requests per address and mails per account", async () => {
    await signUp();
    let mails = 0;
    for (let i = 0; i < RESET_REQUESTS_PER_ADDRESS; i++) {
      mails += (await askLink(ACCOUNT.email, `198.51.100.${i}`)).sent.length;
    }
    expect(mails).toBe(RESET_MAILS_PER_ACCOUNT);
    for (let i = 0; i < RESET_REQUESTS_PER_ADDRESS; i++) await askLink("x@nelcota.test");
    expect((await askLink()).result).toMatchObject({ status: 429, code: "limite" });
    expect((await askLink(ACCOUNT.email, undefined, nextWindow)).sent).toHaveLength(1);
  });

  it("says when the app has no mailbox to send from", async () => {
    const result = await requestPasswordReset(
      { ...deps(), origin: "https://app.test", send: null },
      { email: ACCOUNT.email },
      now,
    );
    expect(result).toMatchObject({ status: 503, code: "sem-envio" });
  });
});

describe("signOut", () => {
  beforeEach(resetDb);

  it("voids that session on the server, so a copied cookie stops working", async () => {
    const result = await signUp();
    if (!result.ok) throw new Error("sign-up failed");
    const token = result.cookie?.split(";")[0] ?? "";
    const request = new Request("https://app.test/api/logout", { headers: { Cookie: token } });

    await signOut(db, request, SECRET, now);
    expect(await sessionOf(result.cookie)).toBeNull();
    expect((await login(ACCOUNT.password)).ok).toBe(true);
  });

  it("keeps the account signed in on its other browsers", async () => {
    const phone = await signUp();
    const laptop = await login(ACCOUNT.password);
    const token = phone.ok ? (phone.cookie?.split(";")[0] ?? "") : "";
    const request = new Request("https://app.test/api/logout", { headers: { Cookie: token } });

    await signOut(db, request, SECRET, now);
    expect(await sessionOf(phone.ok ? phone.cookie : null)).toBeNull();
    expect(await sessionOf(laptop.ok ? laptop.cookie : null)).not.toBeNull();
  });

  it("does nothing without a valid session", async () => {
    await signUp();
    const request = new Request("https://app.test/api/logout");
    await expect(signOut(db, request, SECRET, now)).resolves.toBeUndefined();
  });
});

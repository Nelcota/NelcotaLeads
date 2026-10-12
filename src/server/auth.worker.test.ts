import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { resetDb } from "../../test/reset-db";
import {
  LOGIN_DAILY_FAILURES,
  LOGIN_DAILY_FAILURES_TOTAL,
  attemptLogin,
  loadSessionsValidFrom,
  revokeSessions,
} from "./auth";

const db = getDb(env.DB);
const PASSWORD = "correct horse battery";
const now = new Date("2026-10-11T12:00:00Z");
const tomorrow = new Date("2026-10-12T12:00:00Z");

const login = (input: string, ip = "203.0.113.7", at = now) =>
  attemptLogin(db, { input, password: PASSWORD, ip }, at);

describe("attemptLogin", () => {
  beforeEach(resetDb);

  it("returns a session cookie for the right password", async () => {
    const result = await login(PASSWORD);
    expect(result.ok && result.cookie).toMatch(/^__Host-nelcota_session=\d+\.[\w-]{43};/);
  });

  it("refuses a wrong password", async () => {
    expect(await login("nope")).toMatchObject({ ok: false, status: 401, code: "senha" });
  });

  it("locks an IP out for the day after too many failures, even with the right password", async () => {
    for (let i = 0; i < LOGIN_DAILY_FAILURES; i++) await login("nope");
    expect(await login(PASSWORD)).toMatchObject({ ok: false, status: 429, code: "limite" });
    expect((await login(PASSWORD, "198.51.100.1")).ok).toBe(true);
    expect((await login(PASSWORD, "203.0.113.7", tomorrow)).ok).toBe(true);
  });

  it("counts every address of one IPv6 /64 together", async () => {
    for (let i = 0; i < LOGIN_DAILY_FAILURES; i++) await login("nope", `2001:db8:1:2::${i + 1}`);
    expect(await login(PASSWORD, "2001:db8:1:2:ffff::1")).toMatchObject({ status: 429 });
    expect((await login(PASSWORD, "2001:db8:1:3::1")).ok).toBe(true);
  });

  it("gives each IP a single attempt once the total is reached", async () => {
    for (let i = 0; i < LOGIN_DAILY_FAILURES_TOTAL; i++) await login("nope", `198.51.100.${i}`);
    expect(await login("nope", "198.51.100.0")).toMatchObject({ status: 429 });
    expect(await login("nope", "192.0.2.2")).toMatchObject({ status: 401 });
    expect(await login(PASSWORD, "192.0.2.2")).toMatchObject({ status: 429 });
    expect((await login(PASSWORD, "192.0.2.1")).ok).toBe(true);
  });

  it("counts parallel attempts before comparing, so bursts can't exceed the limit", async () => {
    const results = await Promise.all(
      Array.from({ length: LOGIN_DAILY_FAILURES + 5 }, () => login("nope")),
    );
    expect(results.filter((result) => !result.ok && result.status === 401)).toHaveLength(
      LOGIN_DAILY_FAILURES,
    );
  });

  it("does not count successful logins as failures", async () => {
    for (let i = 0; i < LOGIN_DAILY_FAILURES + 2; i++)
      expect((await login(PASSWORD)).ok).toBe(true);
  });

  it("fails closed without a configured password", async () => {
    const result = await attemptLogin(db, { input: "", password: undefined, ip: "x" }, now);
    expect(result).toMatchObject({ ok: false, status: 503, code: "config" });
  });
});

describe("revokeSessions", () => {
  beforeEach(resetDb);

  it("moves the session cutoff past now, with or without a settings row", async () => {
    expect(await loadSessionsValidFrom(db)).toBe(0);
    await revokeSessions(db, now);
    expect(await loadSessionsValidFrom(db)).toBe(Math.floor(now.getTime() / 1000));
  });
});

import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  authGate,
  createSessionToken,
  ipBucket,
  passwordMatches,
  safeNext,
  verifySessionToken,
} from "./auth";

const PASSWORD = "correct horse battery";
const now = new Date("2026-10-11T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

function request(path: string, init: RequestInit & { cookie?: string; html?: boolean } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("Cookie", init.cookie);
  if (init.html) headers.set("Accept", "text/html,application/xhtml+xml");
  return new Request(`https://app.test${path}`, { ...init, headers });
}

async function sessionCookie(at = now) {
  return `${SESSION_COOKIE}=${await createSessionToken(PASSWORD, at)}`;
}

describe("passwordMatches", () => {
  it("accepts only the exact password", async () => {
    expect(await passwordMatches(PASSWORD, PASSWORD)).toBe(true);
    expect(await passwordMatches(`${PASSWORD} `, PASSWORD)).toBe(false);
    expect(await passwordMatches("", PASSWORD)).toBe(false);
    expect(await passwordMatches("x".repeat(600), PASSWORD)).toBe(false);
  });
});

describe("session tokens", () => {
  it("verifies a fresh token and rejects it after 30 days", async () => {
    const token = await createSessionToken(PASSWORD, now);
    expect(await verifySessionToken(token, PASSWORD, days(29))).not.toBeNull();
    expect(await verifySessionToken(token, PASSWORD, days(31))).toBeNull();
  });

  it("rejects tampered tokens and tokens signed under another password", async () => {
    const token = await createSessionToken(PASSWORD, now);
    const [expires, mac] = token.split(".");
    const later = `${Number(expires) + 86_400}.${mac}`;
    expect(await verifySessionToken(later, PASSWORD, now)).toBeNull();
    expect(await verifySessionToken(token, "another password!", now)).toBeNull();
    expect(await verifySessionToken("garbage", PASSWORD, now)).toBeNull();
    expect(await verifySessionToken(null, PASSWORD, now)).toBeNull();
  });
});

describe("safeNext", () => {
  it.each([
    ["/leads?status=novo", "/leads?status=novo"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["/login?next=/x", "/"],
    ["/a\r\nSet-Cookie: x", "/"],
    [undefined, "/"],
  ])("%s → %s", (value, expected) => {
    expect(safeNext(value)).toBe(expected);
  });
});

describe("authGate", () => {
  it("redirects page loads without a session to the login screen, keeping the path", async () => {
    const gate = await authGate(request("/leads?status=novo", { html: true }), PASSWORD, now);
    expect("response" in gate && gate.response.status).toBe(303);
    expect("response" in gate && gate.response.headers.get("Location")).toBe(
      "/login?next=%2Fleads%3Fstatus%3Dnovo",
    );
  });

  it("answers 401 to server functions and api routes without a session", async () => {
    for (const path of ["/_serverFn/abc", "/api/leads.csv", "/api/logout"]) {
      const gate = await authGate(request(path, { method: "POST" }), PASSWORD, now);
      expect("response" in gate && gate.response.status).toBe(401);
    }
  });

  it("fails closed when APP_PASSWORD is missing or too short", async () => {
    const cookie = await sessionCookie();
    for (const password of [undefined, "", "short"]) {
      const gate = await authGate(request("/api/leads.csv", { cookie }), password, now);
      expect("response" in gate && gate.response.status).toBe(401);
    }
  });

  it("lets the login screen and login endpoint through", async () => {
    expect(await authGate(request("/login", { html: true }), PASSWORD, now)).toEqual({
      renewCookie: null,
    });
    expect(await authGate(request("/api/login", { method: "POST" }), PASSWORD, now)).toEqual({
      renewCookie: null,
    });
  });

  it("sends a signed-in visitor away from the login screen", async () => {
    const gate = await authGate(
      request("/login?next=%2Fconversas", { html: true, cookie: await sessionCookie() }),
      PASSWORD,
      now,
    );
    expect("response" in gate && gate.response.headers.get("Location")).toBe("/conversas");
  });

  it("lets a valid session through and renews it only when it is getting old", async () => {
    const fresh = await authGate(
      request("/", { html: true, cookie: await sessionCookie() }),
      PASSWORD,
      now,
    );
    expect(fresh).toEqual({ renewCookie: null });

    const old = await authGate(
      request("/", { html: true, cookie: await sessionCookie(days(-20)) }),
      PASSWORD,
      now,
    );
    expect("renewCookie" in old && old.renewCookie).toMatch(/HttpOnly; Secure; SameSite=Lax$/);
  });

  it("refuses a session issued before the last logout", async () => {
    const cookie = await sessionCookie(days(-1));
    const issued = Math.floor(now.getTime() / 1000) - 86_400;
    const before = await authGate(
      request("/api/leads.csv", { cookie }),
      PASSWORD,
      now,
      async () => issued + 60,
    );
    expect("response" in before && before.response.status).toBe(401);
    const after = await authGate(
      request("/api/leads.csv", { cookie }),
      PASSWORD,
      now,
      async () => issued - 60,
    );
    expect(after).toEqual({ renewCookie: null });
    // A login in the same second as the logout still works.
    const sameSecond = await authGate(
      request("/api/leads.csv", { cookie }),
      PASSWORD,
      now,
      async () => issued,
    );
    expect(sameSecond).toEqual({ renewCookie: null });
  });

  it.each([
    ["same-site", {}],
    [null, { Origin: "https://evil.test" }],
  ])("blocks writes from Sec-Fetch-Site %s / a foreign Origin", async (site, extra) => {
    const headers: Record<string, string> = { ...extra };
    if (site) headers["Sec-Fetch-Site"] = site;
    const gate = await authGate(
      request("/_serverFn/abc", { method: "POST", cookie: await sessionCookie(), headers }),
      PASSWORD,
      now,
    );
    expect("response" in gate && gate.response.status).toBe(403);
  });

  it("allows same-origin writes and header-less scripts", async () => {
    const cookie = await sessionCookie();
    const variants: Record<string, string>[] = [
      { "Sec-Fetch-Site": "same-origin" },
      { Origin: "https://app.test" },
      {},
    ];
    for (const headers of variants) {
      const gate = await authGate(
        request("/_serverFn/abc", { method: "POST", cookie, headers }),
        PASSWORD,
        now,
      );
      expect(gate).toEqual({ renewCookie: null });
    }
  });

  it("blocks cross-site writes even with a valid session", async () => {
    const gate = await authGate(
      request("/_serverFn/abc", {
        method: "POST",
        cookie: await sessionCookie(),
        headers: { "Sec-Fetch-Site": "cross-site" },
      }),
      PASSWORD,
      now,
    );
    expect("response" in gate && gate.response.status).toBe(403);
  });
});

describe("ipBucket", () => {
  it.each([
    ["203.0.113.7", "203.0.113.7"],
    ["2001:db8:85a3:0042:1000:8a2e:0370:7334", "2001:db8:85a3:42::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["2001:DB8:0:0:ffff::9", "2001:db8:0:0::/64"],
  ])("%s → %s", (ip, bucket) => {
    expect(ipBucket(ip)).toBe(bucket);
  });
});

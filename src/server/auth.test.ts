import { describe, expect, it } from "vitest";
import {
  PUBLIC_PATHS,
  SESSION_COOKIE,
  accessCodeMatches,
  authGate,
  createSessionToken,
  hashPassword,
  ipBucket,
  safeNext,
  verifyPassword,
  verifySessionToken,
  type SessionVersionLookup,
} from "./auth";

const SECRET = "correct horse battery";
const USER = { id: "4f1c2d3e-0000-4000-8000-000000000001", sessionVersion: 1 };
const now = new Date("2026-10-11T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

// The account store as the gate sees it: user id → current session version.
const accounts = new Map([[USER.id, USER.sessionVersion]]);
const lookup: SessionVersionLookup = async (id) => accounts.get(id) ?? null;
const deps = { secret: SECRET, sessionVersion: lookup };

function request(path: string, init: RequestInit & { cookie?: string; html?: boolean } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set("Cookie", init.cookie);
  if (init.html) headers.set("Accept", "text/html,application/xhtml+xml");
  return new Request(`https://app.test${path}`, { ...init, headers });
}

async function sessionCookie(at = now, user = USER) {
  return `${SESSION_COOKIE}=${await createSessionToken(SECRET, user, at)}`;
}

describe("accessCodeMatches", () => {
  it("accepts only the exact code", async () => {
    expect(await accessCodeMatches(SECRET, SECRET)).toBe(true);
    expect(await accessCodeMatches(`${SECRET} `, SECRET)).toBe(false);
    expect(await accessCodeMatches("", SECRET)).toBe(false);
    expect(await accessCodeMatches("x".repeat(600), SECRET)).toBe(false);
  });
});

describe("password hashes", () => {
  it("verifies the right password and nothing else", async () => {
    const stored = await hashPassword("minha senha forte");
    expect(stored).toMatch(/^pbkdf2-sha256\$100000\$[\w-]{22}\$[\w-]{43}$/);
    expect(await verifyPassword("minha senha forte", stored)).toBe(true);
    expect(await verifyPassword("minha senha forte ", stored)).toBe(false);
    expect(await verifyPassword("", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("mesma senha")).not.toBe(await hashPassword("mesma senha"));
  });

  it("rejects malformed stored values", async () => {
    for (const stored of ["", "plain", "md5$1$a$b", "pbkdf2-sha256$x$a$b"]) {
      expect(await verifyPassword("anything", stored)).toBe(false);
    }
  });

  it("answers false, not a crash, for iteration counts out of range", async () => {
    const [, , salt, hash] = (await hashPassword("minha senha forte")).split("$");
    for (const rounds of ["0", "-1", "100001", "1e9", "1.5"]) {
      const stored = `pbkdf2-sha256$${rounds}$${salt}$${hash}`;
      await expect(verifyPassword("minha senha forte", stored)).resolves.toBe(false);
    }
  });
});

describe("session tokens", () => {
  it("verifies a fresh token and rejects it after 30 days", async () => {
    const token = await createSessionToken(SECRET, USER, now);
    expect(await verifySessionToken(token, SECRET, days(29))).toMatchObject({
      userId: USER.id,
      version: 1,
    });
    expect(await verifySessionToken(token, SECRET, days(31))).toBeNull();
  });

  it("rejects tampered tokens and tokens signed under another secret", async () => {
    const token = await createSessionToken(SECRET, USER, now);
    const [id, version, expires, mac] = token.split(".");
    const later = `${id}.${version}.${Number(expires) + 86_400}.${mac}`;
    const otherUser = `other-user.${version}.${expires}.${mac}`;
    const bumped = `${id}.${Number(version) + 1}.${expires}.${mac}`;
    for (const forged of [later, otherUser, bumped]) {
      expect(await verifySessionToken(forged, SECRET, now)).toBeNull();
    }
    expect(await verifySessionToken(token, "another secret!", now)).toBeNull();
    expect(await verifySessionToken("garbage", SECRET, now)).toBeNull();
    expect(await verifySessionToken(null, SECRET, now)).toBeNull();
  });
});

describe("safeNext", () => {
  it.each([
    ["/leads?status=novo", "/leads?status=novo"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["/login?next=/x", "/"],
    ["/criar-conta", "/"],
    ["/redefinir-senha?next=/x", "/"],
    ["/a\r\nSet-Cookie: x", "/"],
    [undefined, "/"],
  ])("%s → %s", (value, expected) => {
    expect(safeNext(value)).toBe(expected);
  });
});

describe("authGate", () => {
  it("redirects page loads without a session to the login screen, keeping the path", async () => {
    const gate = await authGate(request("/leads?status=novo", { html: true }), deps, now);
    expect("response" in gate && gate.response.status).toBe(303);
    expect("response" in gate && gate.response.headers.get("Location")).toBe(
      "/login?next=%2Fleads%3Fstatus%3Dnovo",
    );
  });

  it("answers 401 to server functions and api routes without a session", async () => {
    for (const path of ["/_serverFn/abc", "/api/leads.csv"]) {
      const gate = await authGate(request(path, { method: "POST" }), deps, now);
      expect("response" in gate && gate.response.status).toBe(401);
    }
  });

  it("fails closed when APP_PASSWORD is missing or too short", async () => {
    const cookie = await sessionCookie();
    for (const secret of [undefined, "", "short"]) {
      const gate = await authGate(
        request("/api/leads.csv", { cookie }),
        { secret, sessionVersion: lookup },
        now,
      );
      expect("response" in gate && gate.response.status).toBe(401);
    }
  });

  it("refuses a session whose account was deleted or signed out by a password reset", async () => {
    const gone = await sessionCookie(now, { id: "deleted-user", sessionVersion: 1 });
    const stale = await sessionCookie(now, { ...USER, sessionVersion: 0 });
    for (const cookie of [gone, stale]) {
      const gate = await authGate(request("/api/leads.csv", { cookie }), deps, now);
      expect("response" in gate && gate.response.status).toBe(401);
    }
  });

  it("lets the sign-in screens and their endpoints through", async () => {
    for (const path of ["/login", "/criar-conta", "/redefinir-senha"]) {
      expect(await authGate(request(path, { html: true }), deps, now)).toEqual({
        renewCookie: null,
      });
    }
    for (const path of ["/api/login", "/api/signup", "/api/reset-password"]) {
      expect(await authGate(request(path, { method: "POST" }), deps, now)).toEqual({
        renewCookie: null,
      });
    }
  });

  it("serves the app icons and manifest without a session", async () => {
    const files = [
      "/favicon.svg",
      "/manifest.webmanifest",
      "/apple-touch-icon.png",
      "/icon-192.png",
      "/icon-512.png",
    ];
    for (const path of files) {
      expect(await authGate(request(path), deps, now)).toEqual({ renewCookie: null });
    }
  });

  it("keeps everything else behind the session", async () => {
    expect(PUBLIC_PATHS).toEqual(
      new Set([
        "/login",
        "/criar-conta",
        "/redefinir-senha",
        "/api/login",
        "/api/signup",
        "/api/reset-password",
        "/api/logout",
        "/favicon.svg",
        "/robots.txt",
        "/manifest.webmanifest",
        "/apple-touch-icon.png",
        "/icon-192.png",
        "/icon-512.png",
      ]),
    );
    const near = [
      "/manifest.json",
      "/apple-touch-icon-precomposed.png",
      "/icon-1024.png",
      "/icons/icon-192.png",
      "/icon-192.png/x",
    ];
    for (const path of near) {
      const gate = await authGate(request(path), deps, now);
      expect("response" in gate && gate.response.status).toBe(401);
    }
  });

  it("sends a signed-in visitor away from the sign-in screens", async () => {
    const cookie = await sessionCookie();
    const gate = await authGate(
      request("/login?next=%2Fconversas", { html: true, cookie }),
      deps,
      now,
    );
    expect("response" in gate && gate.response.headers.get("Location")).toBe("/conversas");
    const signUp = await authGate(request("/criar-conta", { html: true, cookie }), deps, now);
    expect("response" in signUp && signUp.response.headers.get("Location")).toBe("/");
  });

  it("lets a valid session through and renews it only when it is getting old", async () => {
    const fresh = await authGate(
      request("/", { html: true, cookie: await sessionCookie() }),
      deps,
      now,
    );
    expect(fresh).toEqual({ renewCookie: null });

    const old = await authGate(
      request("/", { html: true, cookie: await sessionCookie(days(-20)) }),
      deps,
      now,
    );
    expect("renewCookie" in old && old.renewCookie).toMatch(/HttpOnly; Secure; SameSite=Lax$/);
  });

  it.each([
    ["same-site", {}],
    [null, { Origin: "https://evil.test" }],
  ])("blocks writes from Sec-Fetch-Site %s / a foreign Origin", async (site, extra) => {
    const headers: Record<string, string> = { ...extra };
    if (site) headers["Sec-Fetch-Site"] = site;
    const gate = await authGate(
      request("/_serverFn/abc", { method: "POST", cookie: await sessionCookie(), headers }),
      deps,
      now,
    );
    expect("response" in gate && gate.response.status).toBe(403);
  });

  it("blocks cross-site posts to the sign-up endpoint", async () => {
    const gate = await authGate(
      request("/api/signup", { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } }),
      deps,
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
        deps,
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
      deps,
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

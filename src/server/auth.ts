import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { settings } from "@/db/schema";
import { LOGIN_ERRORS, type LoginErrorCode } from "@/lib/login";
import { DEFAULT_SETTINGS, SETTINGS_ID } from "./settings-store";
import { releaseRequest, reserveRequest } from "./usage";

/**
 * Single-user auth: one password (the APP_PASSWORD secret) and a signed, stateless session cookie.
 * The signing key is derived from the password, so changing it signs every session out.
 * Logging out also ends every session: tokens issued before `settings.sessionsValidFrom`
 * are refused, so a copied cookie stops working too.
 */

export const SESSION_COOKIE = "__Host-nelcota_session";
export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 512;
// Failed logins allowed per day (Brazil time), counted in api_usage: per IP (IPv6 per /64) as
// `login:<ip>`, and across all IPs as `login:*`, so rotating addresses doesn't buy more guesses.
// Past the total, an IP gets only its first attempt of the day, so the owner can't be locked out
// by someone else's failures while address rotation still costs the attacker.
export const LOGIN_DAILY_FAILURES = 10;
export const LOGIN_DAILY_FAILURES_TOTAL = 100;

const DAY_SECONDS = 86_400;
const SESSION_SECONDS = 30 * DAY_SECONDS;
// Sessions with less than this left get a fresh cookie on the next page load.
const RENEW_BELOW_SECONDS = 15 * DAY_SECONDS;

// Reachable without a session; everything else, server functions included, is gated.
const PUBLIC_PATHS = new Set(["/login", "/api/login", "/favicon.svg", "/robots.txt"]);

const encoder = new TextEncoder();

export function isPasswordConfigured(password: string | undefined): password is string {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

async function sign(password: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`nelcota-session:${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** Constant-time comparison, so response timing does not leak how much matched. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export async function passwordMatches(input: string, password: string): Promise<boolean> {
  if (input.length > MAX_PASSWORD_LENGTH) return false;
  // Comparing MACs of both values keeps the comparison fixed-length.
  const [given, expected] = await Promise.all([
    sign(password, `password:${input}`),
    sign(password, `password:${password}`),
  ]);
  return equalBytes(given, expected);
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

/** `<expiry unix seconds>.<HMAC of the expiry>` */
export async function createSessionToken(password: string, now = new Date()): Promise<string> {
  const expires = seconds(now) + SESSION_SECONDS;
  return `${expires}.${toBase64Url(await sign(password, `session:${expires}`))}`;
}

/** Returns the expiry (unix seconds) of a valid, unexpired token, or null. */
export async function verifySessionToken(
  token: string | null,
  password: string,
  now = new Date(),
): Promise<number | null> {
  const match = token ? /^(\d{1,12})\.([\w-]{43})$/.exec(token) : null;
  if (!match?.[1] || !match[2]) return null;
  const expires = Number(match[1]);
  if (expires <= seconds(now) || expires > seconds(now) + SESSION_SECONDS) return null;
  const expected = toBase64Url(await sign(password, `session:${expires}`));
  return equalBytes(encoder.encode(match[2]), encoder.encode(expected)) ? expires : null;
}

/** Signs out every session issued up to now. */
export async function revokeSessions(db: Db, now = new Date()) {
  const sessionsValidFrom = seconds(now);
  await db
    .insert(settings)
    .values({ id: SETTINGS_ID, ...DEFAULT_SETTINGS, sessionsValidFrom })
    .onConflictDoUpdate({ target: settings.id, set: { sessionsValidFrom } });
}

/**
 * The logout cutoff. If the database can't answer, sessions are let through rather than
 * taking the whole app down: the signature check still applies.
 */
export async function loadSessionsValidFrom(db: Db): Promise<number> {
  try {
    const row = await db.query.settings.findFirst({
      where: eq(settings.id, SETTINGS_ID),
      columns: { sessionsValidFrom: true },
    });
    return row?.sessionsValidFrom ?? 0;
  } catch (error) {
    console.error("could not read the session cutoff", error);
    return 0;
  }
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("Cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return null;
}

/** Only same-origin paths, so the login redirect can't be turned into an open redirect. */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  // oxlint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(value) || value.startsWith("/login")) return "/";
  return value;
}

/**
 * Browsers send Sec-Fetch-Site on every request; `same-site` is refused too, since sibling
 * Workers on the same account subdomain are same-site. Without it (old browsers, scripts),
 * fall back to Origin, which must match when present.
 */
function isSameOriginWrite(request: Request, url: URL): boolean {
  const site = request.headers.get("Sec-Fetch-Site");
  if (site !== null) return site === "same-origin" || site === "none";
  const origin = request.headers.get("Origin");
  return origin === null || origin === url.origin;
}

function isDocumentRequest(request: Request): boolean {
  return request.method === "GET" && (request.headers.get("Accept") ?? "").includes("text/html");
}

function redirect(location: string, headers: Record<string, string> = {}): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store", ...headers },
  });
}

export function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export type GateResult =
  /** Send this instead of running the app. */
  | { response: Response }
  /** Let the request through; when set, append this Set-Cookie to the app's response. */
  | { renewCookie: string | null };

/** Decides, before the app runs, whether a request may reach it. */
export async function authGate(
  request: Request,
  password: string | undefined,
  now = new Date(),
  sessionsValidFrom: () => Promise<number> = async () => 0,
): Promise<GateResult> {
  const url = new URL(request.url);
  const unsafeMethod = request.method !== "GET" && request.method !== "HEAD";

  // Writes must come from the app itself (CSRF), including the login form.
  if (unsafeMethod && !isSameOriginWrite(request, url)) {
    return { response: jsonResponse({ error: "Origem não permitida." }, 403) };
  }

  let expires = isPasswordConfigured(password)
    ? await verifySessionToken(readCookie(request, SESSION_COOKIE), password, now)
    : null;
  if (expires !== null && expires - SESSION_SECONDS < (await sessionsValidFrom())) expires = null;
  const document = isDocumentRequest(request);

  if (url.pathname === "/login" && expires !== null && document) {
    return { response: redirect(safeNext(url.searchParams.get("next"))) };
  }
  if (PUBLIC_PATHS.has(url.pathname)) return { renewCookie: null };

  if (expires !== null) {
    const renew =
      document && isPasswordConfigured(password) && expires - seconds(now) < RENEW_BELOW_SECONDS;
    return { renewCookie: renew ? sessionCookie(await createSessionToken(password, now)) : null };
  }

  if (document) {
    const next = `${url.pathname}${url.search}`;
    return {
      response: redirect(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`),
    };
  }
  return { response: jsonResponse({ error: "Sessão expirada. Entre novamente." }, 401) };
}

export type LoginResult =
  | { ok: true; cookie: string }
  | { ok: false; status: 401 | 429 | 503; code: LoginErrorCode; error: string };

const loginFailure = (status: 401 | 429 | 503, code: LoginErrorCode): LoginResult => ({
  ok: false,
  status,
  code,
  error: LOGIN_ERRORS[code],
});

/** Throttle key for an address: IPv4 as is, IPv6 by its /64 (one subscriber's block). */
export function ipBucket(ip: string): string {
  if (!ip.includes(":")) return ip;
  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = ip.includes("::")
    ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  return `${groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

/**
 * Checks the password. The attempt is counted before the comparison, so parallel requests
 * can't all slip under the limit; a correct password gives the attempt back.
 */
export async function attemptLogin(
  db: Db,
  attempt: { input: string; password: string | undefined; ip: string },
  now = new Date(),
): Promise<LoginResult> {
  if (!isPasswordConfigured(attempt.password)) return loginFailure(503, "config");

  const perIp = `login:${ipBucket(attempt.ip)}`;
  const total = "login:*";
  if (!(await reserveRequest(db, perIp, LOGIN_DAILY_FAILURES, now))) {
    return loginFailure(429, "limite");
  }
  const counted = await reserveRequest(db, total, LOGIN_DAILY_FAILURES_TOTAL, now);
  if (!counted) {
    await releaseRequest(db, perIp, now);
    if (!(await reserveRequest(db, perIp, 1, now))) return loginFailure(429, "limite");
  }
  if (await passwordMatches(attempt.input, attempt.password)) {
    await Promise.all([
      releaseRequest(db, perIp, now),
      counted ? releaseRequest(db, total, now) : undefined,
    ]);
    return { ok: true, cookie: sessionCookie(await createSessionToken(attempt.password, now)) };
  }
  return loginFailure(401, "senha");
}

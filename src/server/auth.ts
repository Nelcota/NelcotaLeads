import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { users } from "@/db/schema";
import {
  AUTH_PAGES,
  LOGIN_ERRORS,
  MIN_PASSWORD_LENGTH,
  type LoginErrorCode,
  type ResetPasswordInput,
  type SignInInput,
  type SignUpInput,
} from "@/lib/login";
import {
  MAX_PASSWORD_LENGTH,
  equalBytes,
  hashPassword,
  toBase64Url,
  verifyPassword,
} from "@/lib/password";
import { releaseRequest, reserveRequest } from "./usage";

export { hashPassword, verifyPassword };

/**
 * Local accounts (the `users` table) with signed, stateless session cookies.
 *
 * APP_PASSWORD is the server secret: it keys the session signatures and is the access code
 * asked when creating an account or resetting a password, so only people who were given it
 * can get in. Changing it signs every session out.
 */

export const SESSION_COOKIE = "__Host-nelcota_session";
// Failed attempts allowed per day (Brazil time), counted in api_usage: per IP (IPv6 per /64) as
// `login:<ip>`, and across all IPs as `login:*`, so rotating addresses doesn't buy more guesses.
export const LOGIN_DAILY_FAILURES = 10;
export const LOGIN_DAILY_FAILURES_TOTAL = 100;

const DAY_SECONDS = 86_400;
const SESSION_SECONDS = 30 * DAY_SECONDS;
// Sessions with less than this left get a fresh cookie on the next page load.
const RENEW_BELOW_SECONDS = 15 * DAY_SECONDS;

const AUTH_ENDPOINTS = new Set(["/api/login", "/api/signup", "/api/reset-password"]);
// Reachable without a session; everything else, server functions included, is gated.
const PUBLIC_PATHS = new Set([...AUTH_PAGES, ...AUTH_ENDPOINTS, "/favicon.svg", "/robots.txt"]);

const encoder = new TextEncoder();

export function isSecretConfigured(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= MIN_PASSWORD_LENGTH;
}

async function sign(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`nelcota-session:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

/** Whether the access code matches the server secret, compared as fixed-length MACs. */
export async function accessCodeMatches(input: string, secret: string): Promise<boolean> {
  if (input.length > MAX_PASSWORD_LENGTH) return false;
  const [given, expected] = await Promise.all([
    sign(secret, `password:${input}`),
    sign(secret, `password:${secret}`),
  ]);
  return equalBytes(given, expected);
}

// Compared against when the e-mail has no account, so both cases take the same time.
let dummyHash: Promise<string> | null = null;
const timingDecoy = () => (dummyHash ??= hashPassword("timing decoy password"));

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

export type Session = { userId: string; version: number; expires: number };

/** `<user id>.<session version>.<expiry unix seconds>.<HMAC of the three>` */
export async function createSessionToken(
  secret: string,
  user: { id: string; sessionVersion: number },
  now = new Date(),
): Promise<string> {
  const expires = seconds(now) + SESSION_SECONDS;
  const payload = `${user.id}.${user.sessionVersion}.${expires}`;
  return `${payload}.${toBase64Url(await sign(secret, `session:${payload}`))}`;
}

/** Returns the session of a well-signed, unexpired token, or null. Does not check the user. */
export async function verifySessionToken(
  token: string | null,
  secret: string,
  now = new Date(),
): Promise<Session | null> {
  const match = token ? /^([\w-]{1,64})\.(\d{1,9})\.(\d{1,12})\.([\w-]{43})$/.exec(token) : null;
  if (!match?.[1] || !match[2] || !match[3] || !match[4]) return null;
  const expires = Number(match[3]);
  if (expires <= seconds(now) || expires > seconds(now) + SESSION_SECONDS) return null;
  const payload = `${match[1]}.${match[2]}.${match[3]}`;
  const expected = toBase64Url(await sign(secret, `session:${payload}`));
  if (!equalBytes(encoder.encode(match[4]), encoder.encode(expected))) return null;
  return { userId: match[1], version: Number(match[2]), expires };
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export function readCookie(request: Request, name: string): string | null {
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
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  const path = value.split(/[?#]/, 1)[0] ?? "";
  return AUTH_PAGES.has(path) ? "/" : value;
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

/** The current session version of an account, or null when it no longer exists. */
export type SessionVersionLookup = (userId: string) => Promise<number | null>;

export function sessionVersionLookup(db: Db): SessionVersionLookup {
  return async (userId) => {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { sessionVersion: true },
    });
    return row?.sessionVersion ?? null;
  };
}

/** The signed-in session of a request: a valid token whose account still has that version. */
export async function readSession(
  request: Request,
  secret: string | undefined,
  lookup: SessionVersionLookup,
  now = new Date(),
): Promise<Session | null> {
  if (!isSecretConfigured(secret)) return null;
  const session = await verifySessionToken(readCookie(request, SESSION_COOKIE), secret, now);
  if (!session) return null;
  return (await lookup(session.userId)) === session.version ? session : null;
}

export type GateResult =
  /** Send this instead of running the app. */
  | { response: Response }
  /** Let the request through; when set, append this Set-Cookie to the app's response. */
  | { renewCookie: string | null };

/** Decides, before the app runs, whether a request may reach it. */
export async function authGate(
  request: Request,
  deps: { secret: string | undefined; sessionVersion: SessionVersionLookup },
  now = new Date(),
): Promise<GateResult> {
  const url = new URL(request.url);
  const unsafeMethod = request.method !== "GET" && request.method !== "HEAD";

  // Writes must come from the app itself (CSRF), including the sign-in forms.
  if (unsafeMethod && !isSameOriginWrite(request, url)) {
    return { response: jsonResponse({ error: "Origem não permitida." }, 403) };
  }

  const document = isDocumentRequest(request);
  // Public assets skip the session lookup; the sign-in pages need it to send members on.
  const needsSession =
    !PUBLIC_PATHS.has(url.pathname) || (document && AUTH_PAGES.has(url.pathname));
  const session = needsSession
    ? await readSession(request, deps.secret, deps.sessionVersion, now)
    : null;

  if (AUTH_PAGES.has(url.pathname) && session && document) {
    return { response: redirect(safeNext(url.searchParams.get("next"))) };
  }
  if (PUBLIC_PATHS.has(url.pathname)) return { renewCookie: null };

  if (session && isSecretConfigured(deps.secret)) {
    const renew = document && session.expires - seconds(now) < RENEW_BELOW_SECONDS;
    if (!renew) return { renewCookie: null };
    const token = await createSessionToken(
      deps.secret,
      { id: session.userId, sessionVersion: session.version },
      now,
    );
    return { renewCookie: sessionCookie(token) };
  }

  if (document) {
    const next = `${url.pathname}${url.search}`;
    return {
      response: redirect(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`),
    };
  }
  return { response: jsonResponse({ error: "Sessão expirada. Entre novamente." }, 401) };
}

export type AuthResult =
  | { ok: true; cookie: string }
  | { ok: false; status: 401 | 409 | 404 | 429 | 503; code: LoginErrorCode; error: string };

const failure = (status: 401 | 409 | 404 | 429 | 503, code: LoginErrorCode): AuthResult => ({
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

export type AuthDeps = { db: Db; secret: string | undefined; ip: string };

/**
 * Runs `check` as one counted attempt. The attempt is reserved before checking, so parallel
 * requests can't all slip under the limit; a passing check gives it back.
 */
async function throttled(
  { db, ip }: AuthDeps,
  now: Date,
  check: () => Promise<boolean>,
): Promise<"ok" | "failed" | "limited"> {
  const perIp = `login:${ipBucket(ip)}`;
  const total = "login:*";
  if (!(await reserveRequest(db, perIp, LOGIN_DAILY_FAILURES, now))) return "limited";
  if (!(await reserveRequest(db, total, LOGIN_DAILY_FAILURES_TOTAL, now))) {
    await releaseRequest(db, perIp, now);
    return "limited";
  }
  if (!(await check())) return "failed";
  await Promise.all([releaseRequest(db, perIp, now), releaseRequest(db, total, now)]);
  return "ok";
}

async function signedIn(secret: string, user: { id: string; sessionVersion: number }, now: Date) {
  return { ok: true as const, cookie: sessionCookie(await createSessionToken(secret, user, now)) };
}

export async function attemptLogin(
  deps: AuthDeps,
  input: Pick<SignInInput, "email" | "password">,
  now = new Date(),
): Promise<AuthResult> {
  const { secret } = deps;
  if (!isSecretConfigured(secret)) return failure(503, "config");
  const user = await deps.db.query.users.findFirst({ where: eq(users.email, input.email) });
  const outcome = await throttled(deps, now, async () => {
    const valid = await verifyPassword(input.password, user?.passwordHash ?? (await timingDecoy()));
    return valid && user !== undefined;
  });
  if (outcome === "limited") return failure(429, "limite");
  if (outcome === "failed" || !user) return failure(401, "senha");
  return signedIn(secret, user, now);
}

export async function attemptSignUp(
  deps: AuthDeps,
  input: Pick<SignUpInput, "name" | "email" | "password" | "accessCode">,
  now = new Date(),
): Promise<AuthResult> {
  const { secret } = deps;
  if (!isSecretConfigured(secret)) return failure(503, "config");
  const outcome = await throttled(deps, now, () => accessCodeMatches(input.accessCode, secret));
  if (outcome === "limited") return failure(429, "limite");
  if (outcome === "failed") return failure(401, "codigo");

  const [user] = await deps.db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    })
    .onConflictDoNothing({ target: users.email })
    .returning();
  if (!user) return failure(409, "email-em-uso");
  return signedIn(secret, user, now);
}

/** Sets a new password and signs the account out of every other browser. */
export async function attemptPasswordReset(
  deps: AuthDeps,
  input: Pick<ResetPasswordInput, "email" | "password" | "accessCode">,
  now = new Date(),
): Promise<AuthResult> {
  const { secret } = deps;
  if (!isSecretConfigured(secret)) return failure(503, "config");
  const outcome = await throttled(deps, now, () => accessCodeMatches(input.accessCode, secret));
  if (outcome === "limited") return failure(429, "limite");
  if (outcome === "failed") return failure(401, "codigo");

  const [user] = await deps.db
    .update(users)
    .set({
      passwordHash: await hashPassword(input.password),
      sessionVersion: sql`${users.sessionVersion} + 1`,
    })
    .where(eq(users.email, input.email))
    .returning();
  if (!user) return failure(404, "sem-conta");
  return signedIn(secret, user, now);
}

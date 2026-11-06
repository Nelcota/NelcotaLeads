import { env } from "cloudflare:workers";
import type { z } from "zod";
import { getDb } from "@/db/client";
import { fieldErrors, LOGIN_ERRORS } from "@/lib/login";
import { flagOn } from "@/lib/team";
import { jsonResponse, safeNext, type AuthDeps, type AuthResult } from "./auth";

/**
 * Largest body the sign-in forms are read from. The longest valid form (512-character password
 * and access code, a 2,000-character `next`, all percent-encoded) stays well under it; these
 * endpoints are open to anyone, and without a cap a 100 MB body was parsed in full.
 */
export const MAX_AUTH_BODY_BYTES = 64 * 1024;

/** The body's bytes, or null when it is larger than `maxBytes` (read no further than that). */
export async function readLimitedBody(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer> | null> {
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (!Number.isFinite(declared) || declared > maxBytes) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * Accepts JSON (the hydrated page) or a plain form post (before the page hydrates). Undefined
 * when the body is too large.
 */
async function readBody(request: Request): Promise<unknown> {
  const bytes = await readLimitedBody(request, MAX_AUTH_BODY_BYTES);
  if (bytes === null) return undefined;
  // Parsed from the bytes already read, with the original Content-Type (form boundary included).
  const copy = new Request(request.url, { method: "POST", headers: request.headers, body: bytes });
  const isJson = (request.headers.get("Content-Type") ?? "").includes("application/json");
  return isJson
    ? copy.json().catch(() => null)
    : Object.fromEntries(await copy.formData().catch(() => new FormData()));
}

/**
 * The POST handler shared by the sign-in, sign-up and password-reset endpoints. Answers JSON
 * to the page, or redirects back to `page` with `?error=` (or `?sent=1` after a notice) when
 * the form posted natively.
 */
export async function handleAuthPost<S extends z.ZodType<{ next?: string | undefined }>>(
  request: Request,
  page: string,
  schema: S,
  attempt: (deps: AuthDeps, input: z.infer<S>) => Promise<AuthResult>,
): Promise<Response> {
  const wantsJson = (request.headers.get("Accept") ?? "").includes("application/json");
  const back = (params: Record<string, string>, next: string) => {
    const query = new URLSearchParams(params);
    if (next !== "/") query.set("next", next);
    return new Response(null, { status: 303, headers: { Location: `${page}?${query}` } });
  };

  const body = await readBody(request);
  if (body === undefined) {
    return wantsJson
      ? jsonResponse({ error: LOGIN_ERRORS.invalido }, 413)
      : back({ error: "invalido" }, "/");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    if (wantsJson) {
      return jsonResponse({ error: LOGIN_ERRORS.invalido, fields: fieldErrors(parsed.error) }, 400);
    }
    // Kept so the page comes back as it was: the destination, and the reset link's token.
    const field = (name: string) =>
      typeof body === "object" && body !== null && name in body
        ? Reflect.get(body, name)
        : undefined;
    const token = field("token");
    const params: Record<string, string> = { error: "invalido" };
    if (typeof token === "string" && token.length <= 200) params.token = token;
    return back(params, safeNext(field("next") || "/"));
  }

  const next = safeNext(parsed.data.next || "/");
  const result = await attempt(
    {
      db: getDb(),
      secret: env.APP_PASSWORD,
      ip: request.headers.get("CF-Connecting-IP") ?? "local",
      inviteOnly: flagOn(env.INVITE_ONLY_SIGNUP),
    },
    parsed.data,
  );

  if (result.ok && result.cookie === null) {
    return wantsJson ? jsonResponse({ notice: result.notice }, 200) : back({ sent: "1" }, next);
  }
  if (result.ok) {
    const headers = { "Set-Cookie": result.cookie };
    return wantsJson
      ? jsonResponse({ next }, 200, headers)
      : new Response(null, { status: 303, headers: { ...headers, Location: next } });
  }
  return wantsJson
    ? jsonResponse({ error: result.error, code: result.code }, result.status)
    : back({ error: result.code }, next);
}

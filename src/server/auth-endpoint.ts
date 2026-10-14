import { env } from "cloudflare:workers";
import type { z } from "zod";
import { getDb } from "@/db/client";
import { fieldErrors, LOGIN_ERRORS } from "@/lib/login";
import { jsonResponse, safeNext, type AuthDeps, type AuthResult } from "./auth";

/** Accepts JSON (the hydrated page) or a plain form post (before the page hydrates). */
async function readBody(request: Request): Promise<unknown> {
  const isJson = (request.headers.get("Content-Type") ?? "").includes("application/json");
  return isJson
    ? request.json().catch(() => null)
    : Object.fromEntries(await request.formData().catch(() => new FormData()));
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

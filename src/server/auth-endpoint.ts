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
 * to the page, or redirects back to `page` with `?error=` when the form posted natively.
 */
export async function handleAuthPost<S extends z.ZodType<{ next?: string | undefined }>>(
  request: Request,
  page: string,
  schema: S,
  attempt: (deps: AuthDeps, input: z.infer<S>) => Promise<AuthResult>,
): Promise<Response> {
  const wantsJson = (request.headers.get("Accept") ?? "").includes("application/json");
  const back = (code: string, next: string) => {
    const query = new URLSearchParams({ error: code });
    if (next !== "/") query.set("next", next);
    return new Response(null, { status: 303, headers: { Location: `${page}?${query}` } });
  };

  const parsed = schema.safeParse(await readBody(request));
  if (!parsed.success) {
    return wantsJson
      ? jsonResponse({ error: LOGIN_ERRORS.invalido, fields: fieldErrors(parsed.error) }, 400)
      : back("invalido", "/");
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

  if (result.ok) {
    const headers = { "Set-Cookie": result.cookie };
    return wantsJson
      ? jsonResponse({ next }, 200, headers)
      : new Response(null, { status: 303, headers: { ...headers, Location: next } });
  }
  return wantsJson
    ? jsonResponse({ error: result.error, code: result.code }, result.status)
    : back(result.code, next);
}

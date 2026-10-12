import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { getDb } from "@/db/client";
import { attemptLogin, jsonResponse, safeNext } from "@/server/auth";

const credentialsSchema = z.object({
  password: z.string().max(512),
  next: z.string().max(2000).optional(),
});

/** Accepts JSON (the login page) or a plain form post (before the page hydrates). */
async function readCredentials(request: Request) {
  const isJson = (request.headers.get("Content-Type") ?? "").includes("application/json");
  const raw: unknown = isJson
    ? await request.json().catch(() => null)
    : Object.fromEntries(await request.formData().catch(() => new FormData()));
  return credentialsSchema.safeParse(raw);
}

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const wantsJson = (request.headers.get("Accept") ?? "").includes("application/json");
        const credentials = await readCredentials(request);
        if (!credentials.success) return jsonResponse({ error: "Pedido inválido." }, 400);

        const next = safeNext(credentials.data.next || "/");
        const result = await attemptLogin(getDb(), {
          input: credentials.data.password,
          password: env.APP_PASSWORD,
          ip: request.headers.get("CF-Connecting-IP") ?? "local",
        });

        if (result.ok) {
          const headers = { "Set-Cookie": result.cookie };
          return wantsJson
            ? jsonResponse({ next }, 200, headers)
            : new Response(null, { status: 303, headers: { ...headers, Location: next } });
        }
        if (wantsJson) return jsonResponse({ error: result.error }, result.status);
        const query = new URLSearchParams({ error: result.code });
        if (next !== "/") query.set("next", next);
        return new Response(null, { status: 303, headers: { Location: `/login?${query}` } });
      },
    },
  },
});

import handler from "@tanstack/react-start/server-entry";
import { getDb } from "./db/client";
import { getAnalyzer } from "./lib/ai";
import { fetchSite } from "./lib/scrape";
import { authGate } from "./server/auth";
import { handleLeadBatch } from "./server/consumer";
import type { LeadJob } from "./server/queue";
import { runTick } from "./server/tick";

// Defense in depth on every response. script-src stays open: SSR hydration uses inline scripts.
const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function withHeaders(response: Response, setCookie: string | null): Response {
  const out = new Response(response.body, response);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!out.headers.has(name)) out.headers.set(name, value);
  }
  if (setCookie) out.headers.append("Set-Cookie", setCookie);
  return out;
}

export default {
  fetch: async (request, env) => {
    const gate = await authGate(request, env.APP_PASSWORD);
    if ("response" in gate) return withHeaders(gate.response, null);
    return withHeaders(await handler.fetch(request), gate.renewCookie);
  },
  queue: (batch, env) =>
    handleLeadBatch(batch, {
      db: getDb(env.DB),
      analyzer: getAnalyzer(env),
      fetchSite: (url) => fetchSite(url),
    }),
  scheduled: (_controller, env, ctx) => {
    ctx.waitUntil(runTick(env, new Date()));
  },
} satisfies ExportedHandler<Env, LeadJob>;

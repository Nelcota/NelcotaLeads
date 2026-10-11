import { env } from "cloudflare:test";

/** Clears all app tables; the Workers test pool shares one D1 database per test file. */
export async function resetDb() {
  await env.DB.batch(
    ["emails", "analyses", "leads", "searches", "settings", "api_usage"].map((table) =>
      env.DB.prepare(`DELETE FROM ${table}`),
    ),
  );
}

import { env } from "cloudflare:test";

/** Clears all app tables; the Workers test pool shares one D1 database per test file. */
export async function resetDb() {
  await env.DB.batch(
    ["analyses", "leads", "searches", "settings"].map((table) =>
      env.DB.prepare(`DELETE FROM ${table}`),
    ),
  );
}

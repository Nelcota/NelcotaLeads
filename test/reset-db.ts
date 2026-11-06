import { env } from "cloudflare:test";

/** Clears all app tables; the Workers test pool shares one D1 database per test file. */
export async function resetDb() {
  await env.DB.batch(
    [
      "lead_events",
      "meetings",
      "proposals",
      "services",
      "service_addons",
      "emails",
      "analyses",
      "leads",
      "searches",
      "settings",
      "api_usage",
      "users",
      "revoked_sessions",
      "quick_replies",
      "job_runs",
      "monthly_goals",
      "invites",
    ].map((table) => env.DB.prepare(`DELETE FROM ${table}`)),
  );
}

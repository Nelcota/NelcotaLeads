import handler from "@tanstack/react-start/server-entry";
import { getDb } from "./db/client";
import { getAnalyzer } from "./lib/ai";
import { fetchSite } from "./lib/scrape";
import { handleLeadBatch } from "./server/consumer";
import type { LeadJob } from "./server/queue";

export default {
  fetch: (request) => handler.fetch(request),
  queue: (batch, env) =>
    handleLeadBatch(batch, {
      db: getDb(env.DB),
      analyzer: getAnalyzer(env),
      fetchSite: (url) => fetchSite(url),
    }),
} satisfies ExportedHandler<Env, LeadJob>;

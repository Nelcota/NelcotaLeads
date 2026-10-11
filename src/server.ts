import handler from "@tanstack/react-start/server-entry";
import type { LeadJob } from "./server/queue";
import { handleLeadBatch } from "./server/consumer";

export default {
  fetch: (request) => handler.fetch(request),
  queue: (batch, env) => handleLeadBatch(batch, env),
} satisfies ExportedHandler<Env, LeadJob>;

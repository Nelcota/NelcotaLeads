import { getDb } from "@/db/client";
import { getAnalyzer } from "@/lib/ai";
import { fetchSite } from "@/lib/scrape";
import { failLead, MAX_ATTEMPTS, processLead } from "./process-lead";
import type { LeadJob } from "./queue";

/** Queue consumer: one message per lead, processed concurrently within the batch. */
export async function handleLeadBatch(batch: MessageBatch<LeadJob>, env: Env) {
  const deps = {
    db: getDb(env.DB),
    analyzer: getAnalyzer(env),
    fetchSite: (url: string) => fetchSite(url),
  };

  await Promise.all(
    batch.messages.map(async (message) => {
      try {
        await processLead(deps, message.body);
        message.ack();
      } catch (error) {
        console.error("lead processing failed", message.body.leadId, message.attempts, error);
        if (message.attempts >= MAX_ATTEMPTS) {
          await failLead(deps.db, message.body, error);
          message.ack();
        } else {
          // Exponential backoff: 30s, 60s, ...
          message.retry({ delaySeconds: 30 * 2 ** (message.attempts - 1) });
        }
      }
    }),
  );
}

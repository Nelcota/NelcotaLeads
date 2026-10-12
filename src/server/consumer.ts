import { failLead, MAX_ATTEMPTS, processLead, type ProcessDeps } from "./process-lead";
import type { LeadJob } from "./queue";

export const DEAD_LETTER_QUEUE = "nelcota-leads-analysis-dlq";

/** Queue consumer: one message per lead, processed concurrently within the batch. */
export async function handleLeadBatch(batch: MessageBatch<LeadJob>, deps: ProcessDeps) {
  // Safety net: messages that exhausted the queue's own retries still get their lead marked.
  if (batch.queue === DEAD_LETTER_QUEUE) {
    for (const message of batch.messages) {
      try {
        await failLead(deps.db, message.body, new Error("Falha após todas as tentativas"));
        message.ack();
      } catch (error) {
        console.error("could not record the dead-lettered lead", message.body.leadId, error);
        message.retry();
      }
    }
    return;
  }

  await Promise.all(
    batch.messages.map(async (message) => {
      try {
        await processLead(deps, message.body);
        message.ack();
      } catch (error) {
        console.error("lead processing failed", message.body.leadId, message.attempts, error);
        if (message.attempts >= MAX_ATTEMPTS) {
          // A failure to record the failure must not reject the rest of the batch.
          try {
            await failLead(deps.db, message.body, error);
            message.ack();
          } catch (failError) {
            console.error("could not record the lead failure", message.body.leadId, failError);
            message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
          }
        } else {
          message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
        }
      }
    }),
  );
}

/** Exponential backoff: 30s, 60s, 120s… */
export function retryDelaySeconds(attempts: number) {
  return 30 * 2 ** (attempts - 1);
}

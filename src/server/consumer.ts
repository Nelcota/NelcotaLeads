import { recordJobRun } from "./job-runs";
import {
  failLead,
  LEAD_BUSY_MESSAGE,
  MAX_ATTEMPTS,
  processLead,
  type ProcessDeps,
} from "./process-lead";
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
    if (batch.messages.length > 0) {
      await recordJobRun(deps.db, "analysis-queue", {
        status: "failed",
        error: new Error("dead-lettered"),
      });
    }
    return;
  }

  let worked = 0;
  let gaveUp = 0;
  await Promise.all(
    batch.messages.map(async (message) => {
      try {
        await processLead(deps, message.body);
        message.ack();
        worked += 1;
      } catch (error) {
        console.error("lead processing failed", message.body.leadId, message.attempts, error);
        if (message.attempts >= MAX_ATTEMPTS && isBusy(error)) {
          // A duplicate delivery: another job holds a live claim on the lead. Its retries
          // (30 s + 60 s) run out before an analysis may end (site reads plus a 90 s model
          // call), and failing the lead here would undo the analysis still running. That
          // job's own message is redelivered if it dies, so this one can just go.
          message.ack();
          return;
        }
        if (message.attempts < MAX_ATTEMPTS) {
          message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
          return;
        }
        gaveUp += 1;
        // A failure to record the failure must not reject the rest of the batch.
        try {
          await failLead(deps.db, message.body, error);
          message.ack();
        } catch (failError) {
          console.error("could not record the lead failure", message.body.leadId, failError);
          message.retry({ delaySeconds: retryDelaySeconds(message.attempts) });
        }
      }
    }),
  );
  // One lead whose site breaks the analysis is shown on that lead; only a batch where nothing
  // worked and some lead was given up on (e.g. the AI is down) marks the task as failing.
  if (worked > 0) {
    await recordJobRun(deps.db, "analysis-queue", { status: "ok" });
    return;
  }
  if (gaveUp > 0) {
    await recordJobRun(deps.db, "analysis-queue", {
      status: "failed",
      error: new Error("analysis gave up"),
    });
  }
}

function isBusy(error: unknown) {
  return error instanceof Error && error.message === LEAD_BUSY_MESSAGE;
}

/** Exponential backoff: 30s, 60s, 120s… */
export function retryDelaySeconds(attempts: number) {
  return 30 * 2 ** (attempts - 1);
}

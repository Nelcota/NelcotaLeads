import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { jobRuns } from "@/db/schema";
import type { Mailer } from "@/lib/mail";
import {
  friendlyJobError,
  isRecipientRejection,
  JOBS,
  jobState,
  type Job,
  type JobReason,
  type JobState,
} from "@/lib/system-status";
import { sendDue } from "./mail-flow";
import { loadConfig, type StoredConfig } from "./settings-store";

export type JobOutcome =
  | { status: "ok" }
  | { status: "idle" }
  | { status: "failed"; error: unknown };

/**
 * Upserts the task's row. `idle` (nothing to do) only moves `lastRunAt`, so a failure stays
 * visible until the task really works again. Never throws: health tracking must not break the
 * task it tracks.
 */
export async function recordJobRun(db: Db, job: Job, outcome: JobOutcome, now = new Date()) {
  try {
    if (outcome.status === "idle") {
      await db
        .insert(jobRuns)
        .values({ job, lastRunAt: now })
        .onConflictDoUpdate({ target: jobRuns.job, set: { lastRunAt: now } });
    } else if (outcome.status === "ok") {
      await db
        .insert(jobRuns)
        .values({ job, lastRunAt: now, lastOkAt: now, consecutiveFailures: 0 })
        .onConflictDoUpdate({
          target: jobRuns.job,
          set: { lastRunAt: now, lastOkAt: now, consecutiveFailures: 0 },
        });
    } else {
      const lastError = friendlyJobError(job, outcome.error);
      await db
        .insert(jobRuns)
        .values({ job, lastRunAt: now, lastErrorAt: now, lastError, consecutiveFailures: 1 })
        .onConflictDoUpdate({
          target: jobRuns.job,
          set: {
            lastRunAt: now,
            lastErrorAt: now,
            lastError,
            consecutiveFailures: sql`${jobRuns.consecutiveFailures} + 1`,
          },
        });
    }
  } catch (error) {
    console.error(`job_runs: could not record ${job}`, error);
  }
}

/**
 * Runs a task and records how it went. A failure is logged with its raw text, recorded with a
 * friendly one, and thrown again for the caller. `isIdle` marks results where nothing was done.
 */
export async function trackJob<T>(
  db: Db,
  job: Job,
  task: () => Promise<T>,
  { now = new Date(), isIdle }: { now?: Date; isIdle?: (result: T) => boolean } = {},
): Promise<T> {
  let result: T;
  try {
    result = await task();
  } catch (error) {
    console.error(`job ${job} failed`, error);
    await recordJobRun(db, job, { status: "failed", error }, now);
    throw error;
  }
  await recordJobRun(db, job, { status: isIdle?.(result) ? "idle" : "ok" }, now);
  return result;
}

/**
 * `sendDue` as the "send" task. A send the mail server refused fails the task (the e-mail itself
 * is already marked failed and the rest of the app goes on as before); an empty queue is idle.
 * `verifyWhenIdle` (the manual "Tentar agora") checks the connection when the task is failing
 * and there is nothing to send, so a fixed password turns it green.
 */
export async function runSendJob(
  deps: { db: Db; mailer: Mailer; limit: number },
  now = new Date(),
  { verifyWhenIdle = false } = {},
): Promise<number> {
  const { db, mailer } = deps;
  let attempts = 0;
  let failure: unknown;
  const watched: Mailer = {
    ...mailer,
    send: async (email) => {
      attempts += 1;
      try {
        await mailer.send(email);
      } catch (error) {
        if (!isRecipientRejection(error)) failure = error;
        throw error;
      }
    },
  };
  return trackJob(
    db,
    "send",
    async () => {
      const sent = await sendDue({ ...deps, mailer: watched }, now);
      if (failure !== undefined) throw failure;
      if (attempts === 0 && verifyWhenIdle && (await isFailing(db, "send"))) {
        await mailer.verify();
        attempts = 1;
      }
      return sent;
    },
    { now, isIdle: () => attempts === 0 },
  );
}

async function isFailing(db: Db, job: Job) {
  const row = await db.query.jobRuns.findFirst({ where: eq(jobRuns.job, job) });
  return (row?.consecutiveFailures ?? 0) > 0;
}

export type JobStatus = {
  job: Job;
  state: JobState;
  reason: JobReason;
  lastRunAt: Date | null;
  lastErrorAt: Date | null;
  /** The friendly message of the last failure, only while the task is failing. */
  error: string | null;
};

/**
 * Every task with its derived state; `mailConfigured` comes from the Worker's secrets. A caller
 * that also needs the settings row passes its own read (`config`), so it is read once.
 */
export async function loadSystemStatus(
  db: Db,
  {
    mailConfigured,
    now = new Date(),
    config: preloaded,
  }: { mailConfigured: boolean; now?: Date; config?: Promise<StoredConfig> },
): Promise<JobStatus[]> {
  const [rows, config] = await Promise.all([
    db.select().from(jobRuns),
    preloaded ?? loadConfig(db),
  ]);
  const byJob = new Map(rows.map((row) => [row.job, row]));
  const off: Record<Job, boolean> = {
    send: !mailConfigured,
    inbox: !mailConfigured,
    "follow-ups": !mailConfigured,
    "auto-dispatch": !mailConfigured || !config.autoDispatch,
    autopilot: !config.autopilot.enabled || config.autopilot.targets.length === 0,
    "analysis-queue": false,
  };
  return JOBS.map((job) => {
    const run = byJob.get(job);
    const { state, reason } = jobState(job, run, { now, off: off[job] });
    return {
      job,
      state,
      reason,
      lastRunAt: run?.lastRunAt ?? null,
      lastErrorAt: run?.lastErrorAt ?? null,
      error: reason === "failing" ? (run?.lastError ?? null) : null,
    };
  });
}

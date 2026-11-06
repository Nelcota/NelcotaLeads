import { getDb, type Db } from "@/db/client";
import { getAnalyzer } from "@/lib/ai";
import { getMailer, mailConfigured } from "@/lib/mail";
import { salesEmailsEnabled } from "@/lib/sales-email";
import type { Job } from "@/lib/system-status";
import { autopilotDeps, runAutopilot } from "./autopilot";
import { runSendJob, trackJob } from "./job-runs";
import { autoDispatch, mailDailyLimit, pollInbox, queueFollowUps } from "./mail-flow";

/**
 * Runs one step and records it in `job_runs`. One failing step (e.g. the mail server is down)
 * must not stop the others; trackJob already logged and recorded the failure.
 */
export async function runStep<T>(
  db: Db,
  job: Job,
  task: () => Promise<T>,
  now: Date,
  isIdle?: (result: T) => boolean,
) {
  try {
    await trackJob(db, job, task, { now, isIdle });
  } catch {
    // Recorded by trackJob.
  }
}

/**
 * The per-minute cron. Every minute: send the next queued e-mail. Every 5 minutes: read
 * replies and queue follow-ups. On the hour: daily searches and automatic dispatch.
 */
export async function runTick(
  env: Env & Pick<Cloudflare.Env, "SALES_EMAILS_ENABLED">,
  now = new Date(),
) {
  const db = getDb(env.DB);
  const minute = now.getUTCMinutes();
  const limit = mailDailyLimit(env.MAIL_DAILY_LIMIT);
  const salesEmails = salesEmailsEnabled(env.SALES_EMAILS_ENABLED);

  if (mailConfigured(env)) {
    const mailer = getMailer(env);
    try {
      await runSendJob({ db, mailer, limit, salesEmails }, now);
    } catch {
      // Recorded by runSendJob.
    }
    if (minute % 5 === 0) {
      const analyzer = getAnalyzer(env);
      await runStep(db, "inbox", () => pollInbox({ db, mailer, analyzer }, now), now);
      await runStep(
        db,
        "follow-ups",
        () => queueFollowUps({ db, analyzer, fromAddress: mailer.address }, now),
        now,
      );
    }
    if (minute === 0) {
      await runStep(
        db,
        "auto-dispatch",
        () =>
          autoDispatch({ db, analyzer: getAnalyzer(env), fromAddress: mailer.address, limit }, now),
        now,
      );
    }
  }
  if (minute === 0) {
    await runStep(
      db,
      "autopilot",
      async () => {
        const result = await runAutopilot(autopilotDeps(env), now);
        if (result.failure !== undefined) throw result.failure;
        return result;
      },
      now,
      // Not due this hour (or already done today): nothing ran.
      (result) => result.searches === 0,
    );
  }
}

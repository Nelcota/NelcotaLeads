import { getDb } from "@/db/client";
import { getAnalyzer } from "@/lib/ai";
import { getMailer, mailConfigured } from "@/lib/mail";
import { autopilotDeps, runAutopilot } from "./autopilot";
import { autoDispatch, mailDailyLimit, pollInbox, queueFollowUps, sendDue } from "./mail-flow";

async function step(name: string, task: () => Promise<unknown>) {
  try {
    await task();
  } catch (error) {
    // One failing step (e.g. the mail server is down) must not stop the others.
    console.error(`tick: ${name} failed`, error);
  }
}

/**
 * The per-minute cron. Every minute: send the next queued e-mail. Every 5 minutes: read
 * replies and queue follow-ups. On the hour: daily searches and automatic dispatch.
 */
export async function runTick(env: Env, now = new Date()) {
  const db = getDb(env.DB);
  const minute = now.getUTCMinutes();
  const limit = mailDailyLimit(env.MAIL_DAILY_LIMIT);

  if (mailConfigured(env)) {
    const mailer = getMailer(env);
    await step("send", () => sendDue({ db, mailer, limit }, now));
    if (minute % 5 === 0) {
      const analyzer = getAnalyzer(env);
      await step("inbox", () => pollInbox({ db, mailer, analyzer }, now));
      await step("follow-ups", () =>
        queueFollowUps({ db, analyzer, fromAddress: mailer.address }, now),
      );
    }
    if (minute === 0) {
      await step("auto dispatch", () =>
        autoDispatch({ db, analyzer: getAnalyzer(env), fromAddress: mailer.address, limit }, now),
      );
    }
  }
  if (minute === 0) await step("autopilot", () => runAutopilot(autopilotDeps(env), now));
}

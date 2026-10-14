import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db/client";
import { emails, jobRuns, leads, searches } from "@/db/schema";
import type { OutgoingEmail } from "@/lib/mail";
import { MAILBOX_REFUSED } from "@/lib/system-status";
import { createFakeMailer } from "../../test/fake-mailer";
import { resetDb } from "../../test/reset-db";
import { loadSystemStatus, recordJobRun, runSendJob, trackJob, watchSends } from "./job-runs";
import { DEFAULT_CONFIG, writeAutopilot } from "./settings-store";
import { runStep, runTick } from "./tick";

const db = getDb(env.DB);
const now = new Date("2026-10-12T15:01:00Z");

function fail(): never {
  throw new Error("D1_ERROR: unavailable");
}

/** A database whose every call throws, like D1 being unavailable. */
function brokenDb() {
  // Only prepare/batch/exec are reached through drizzle.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return getDb({ prepare: fail, batch: fail, exec: fail, dump: fail } as unknown as D1Database);
}

async function row(job: string) {
  return db.query.jobRuns.findFirst({ where: eq(jobRuns.job, job) });
}

async function queueEmail(id = "e1") {
  await db
    .insert(searches)
    .values({ id: "s", niche: "x", city: "y", maxResults: 1 })
    .onConflictDoNothing();
  await db.insert(leads).values({
    id: `lead-${id}`,
    searchId: "s",
    placeId: `p-${id}`,
    name: "Clínica",
    email: "a@b.com",
  });
  await db.insert(emails).values({
    id,
    leadId: `lead-${id}`,
    direction: "out",
    status: "queued",
    author: "user",
    fromAddress: "eu@exemplo.com.br",
    toAddress: "a@b.com",
    subject: "Oi",
    body: "Olá",
    sendAfter: new Date(now.getTime() - 60_000),
  });
}

describe("job runs", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("the tick's step records a success and a failure with a friendly message", async () => {
    await runStep(db, "inbox", async () => 1, now);
    expect(await row("inbox")).toMatchObject({ consecutiveFailures: 0, lastOkAt: now });

    const later = new Date(now.getTime() + 5 * 60_000);
    await runStep(
      db,
      "inbox",
      () => Promise.reject(new Error("IMAP: NO [AUTHENTICATIONFAILED]")),
      later,
    );
    await runStep(db, "inbox", () => Promise.reject(new Error("IMAP: NO")), later);
    expect(await row("inbox")).toMatchObject({
      lastRunAt: later,
      lastOkAt: now,
      lastErrorAt: later,
      lastError: MAILBOX_REFUSED,
      consecutiveFailures: 2,
    });

    await runStep(db, "inbox", async () => 0, later);
    expect(await row("inbox")).toMatchObject({ consecutiveFailures: 0, lastOkAt: later });
  });

  it("an idle run keeps a failure visible", async () => {
    await recordJobRun(db, "autopilot", { status: "failed", error: new Error("x") }, now);
    await runStep(
      db,
      "autopilot",
      async () => ({ searches: 0 }),
      now,
      (r) => r.searches === 0,
    );
    expect(await row("autopilot")).toMatchObject({ consecutiveFailures: 1, lastOkAt: null });
  });

  it("a failure to record never breaks the task or the tick", async () => {
    const broken = brokenDb();
    await expect(trackJob(broken, "send", async () => 7)).resolves.toBe(7);
    await expect(runStep(broken, "send", () => Promise.reject(new Error("x")), now)).resolves.toBe(
      undefined,
    );
    await expect(
      recordJobRun(broken, "send", { status: "failed", error: new Error("x") }),
    ).resolves.toBe(undefined);
  });

  it("the cron keeps going when a step fails, and records it", async () => {
    // No mailbox (nothing real is reached) and no Google key: the hourly autopilot step throws.
    const offline = {
      ...env,
      MAIL_ADDRESS: "",
      MAIL_PASSWORD: "",
      GOOGLE_PLACES_API_KEY: "",
    };
    await writeAutopilot(db, { autopilotEnabled: true });
    await expect(runTick(offline, new Date("2026-10-12T15:00:00Z"))).resolves.toBe(undefined);
    expect(await row("autopilot")).toMatchObject({ consecutiveFailures: 1 });
  });

  it("a send the server refuses fails the send task; an empty queue is idle", async () => {
    const fake = createFakeMailer();
    await queueEmail();
    fake.failNext();
    await expect(runSendJob({ db, mailer: fake.mailer, limit: 30 }, now)).rejects.toThrow("SMTP");
    expect(await row("send")).toMatchObject({ consecutiveFailures: 1, lastError: MAILBOX_REFUSED });
    // The e-mail itself is marked failed, as before.
    expect((await db.query.emails.findFirst())?.status).toBe("failed");

    await expect(runSendJob({ db, mailer: fake.mailer, limit: 30 }, now)).resolves.toBe(0);
    expect(await row("send")).toMatchObject({ consecutiveFailures: 1 });

    // "Tentar agora" with nothing to send checks the connection instead.
    await runSendJob({ db, mailer: fake.mailer, limit: 30 }, now, { verifyWhenIdle: true });
    expect(await row("send")).toMatchObject({ consecutiveFailures: 0, lastOkAt: now });
  });

  it("a rejected recipient is not a mailbox failure", async () => {
    const fake = createFakeMailer();
    fake.mailer.send = () => Promise.reject(new Error("SMTP destinatário: 550 no such user"));
    await queueEmail();
    await expect(runSendJob({ db, mailer: fake.mailer, limit: 30 }, now)).resolves.toBe(0);
    expect(await row("send")).toMatchObject({ consecutiveFailures: 0 });
  });
});

describe("loadSystemStatus", () => {
  beforeEach(resetDb);

  it("derives each task's state and only shows the message while failing", async () => {
    await recordJobRun(db, "send", { status: "ok" }, now);
    for (let i = 0; i < 3; i += 1) {
      await recordJobRun(db, "inbox", { status: "failed", error: new Error("IMAP: x") }, now);
    }
    await recordJobRun(db, "follow-ups", { status: "failed", error: new Error("boom") }, now);
    await recordJobRun(db, "follow-ups", { status: "ok" }, now);

    const status = await loadSystemStatus(db, { mailConfigured: true, now });
    const byJob = Object.fromEntries(status.map((job) => [job.job, job]));
    expect(status.map((job) => job.job)).toEqual([
      "send",
      "inbox",
      "follow-ups",
      "auto-dispatch",
      "autopilot",
      "analysis-queue",
    ]);
    expect(byJob.send).toMatchObject({ state: "ok", error: null });
    expect(byJob.inbox).toMatchObject({ state: "error", error: MAILBOX_REFUSED });
    expect(byJob["follow-ups"]).toMatchObject({ state: "ok", error: null });
    // Automatic dispatch and the autopilot are off by default.
    expect(byJob["auto-dispatch"]).toMatchObject({ state: "off", reason: "off" });
    expect(byJob.autopilot).toMatchObject({ state: "off", reason: "off" });
    expect(byJob["analysis-queue"]).toMatchObject({ state: "off", reason: "never" });

    const disconnected = await loadSystemStatus(db, { mailConfigured: false, now });
    expect(disconnected.find((job) => job.job === "inbox")).toMatchObject({ state: "off" });
  });

  it("uses a settings read the caller already started", async () => {
    const config = Promise.resolve({
      ...DEFAULT_CONFIG,
      autoDispatch: true,
    });
    const status = await loadSystemStatus(db, { mailConfigured: true, now, config });
    // On only in the passed config (the stored row keeps the default, off).
    expect(status.find((job) => job.job === "auto-dispatch")?.reason).toBe("never");
  });
});

/** A mailer whose every send fails with `message`. */
const throwing = (message: string) => ({
  ...createFakeMailer().mailer,
  send: async () => {
    throw new Error(message);
  },
});

describe("watchSends", () => {
  beforeEach(resetDb);

  const email: OutgoingEmail = {
    from: { address: "eu@exemplo.com.br" },
    to: "a@b.test",
    subject: "Oi",
    text: "Olá",
    messageId: "<1@exemplo.com.br>",
    date: now,
  };

  it("records a send made outside the queue job as a working mailbox", async () => {
    const watch = watchSends(createFakeMailer().mailer);
    await watch.mailer.send(email);
    await watch.record(db, now);
    expect(await row("send")).toMatchObject({ consecutiveFailures: 0, lastOkAt: now });
  });

  it("records a refused send as a failing mailbox", async () => {
    const watch = watchSends(throwing("SMTP envio: 550 recusado"));
    await expect(watch.mailer.send(email)).rejects.toThrow("SMTP envio");
    await watch.record(db, now);
    expect(await row("send")).toMatchObject({ consecutiveFailures: 1, lastErrorAt: now });
  });

  it("doesn't blame the mailbox for one rejected recipient", async () => {
    const watch = watchSends(throwing("SMTP destinatário: 550 no such user"));
    await expect(watch.mailer.send(email)).rejects.toThrow("SMTP destinatário");
    await watch.record(db, now);
    expect(await row("send")).toMatchObject({ consecutiveFailures: 0 });
  });

  it("records nothing when nothing was sent", async () => {
    await watchSends(createFakeMailer().mailer).record(db, now);
    expect(await row("send")).toBeUndefined();
  });
});

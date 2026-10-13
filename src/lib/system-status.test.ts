import { describe, expect, it } from "vitest";
import {
  friendlyJobError,
  GOOGLE_LIMIT,
  JOBS,
  jobState,
  MAILBOX_REFUSED,
  needsAttention,
  timeAgo,
  type JobRunInfo,
} from "./system-status";

const now = new Date("2026-10-12T15:00:00Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

function run(overrides: Partial<JobRunInfo> = {}): JobRunInfo {
  return {
    lastRunAt: minutesAgo(1),
    lastOkAt: minutesAgo(1),
    lastErrorAt: null,
    consecutiveFailures: 0,
    ...overrides,
  };
}

describe("friendlyJobError", () => {
  const raw = [
    "SMTP login: 535 5.7.8 Error: authentication failed: UGFzc3dvcmQ6",
    "IMAP: * BYE [UNAVAILABLE] Server shutting down",
    "Tempo esgotado na conexão com o servidor de e-mail",
    "connect ECONNREFUSED 10.0.0.1:993",
    "Limite diário de requisições ao Google atingido: coletadas 3 de até 20 empresas.",
    "Google Places respondeu 429: RESOURCE_EXHAUSTED quota",
    "SMTP destinatário: 550 5.1.1 <x@y.com> mailbox unavailable",
    "D1_ERROR: no such table: job_runs at /src/server/tick.ts:12",
    "TypeError: Cannot read properties of undefined (reading 'send')",
    "",
  ];

  it.each(JOBS)("never returns the raw error text (%s)", (job) => {
    for (const text of raw) {
      const message = friendlyJobError(job, new Error(text));
      expect(message).not.toBe(text);
      expect(message).not.toMatch(/\d{3}|ECONN|D1_|TypeError|<|:\s/);
      expect(message).toMatch(/^[A-ZÀ-Ý].*\.$/);
    }
    expect(friendlyJobError(job, "string thrown")).not.toBe("string thrown");
    expect(friendlyJobError(job, { message: "object" })).not.toContain("object");
  });

  it.each([
    ["SMTP login: 535 auth failed", MAILBOX_REFUSED],
    ["IMAP: login refused", MAILBOX_REFUSED],
    ["Conexão encerrada pelo servidor de e-mail", MAILBOX_REFUSED],
    ["Limite diário de requisições ao Google atingido. A busca não foi feita", GOOGLE_LIMIT],
  ])("maps %j to a known sentence", (text, expected) => {
    expect(friendlyJobError("inbox", new Error(text))).toBe(expected);
  });

  it("falls back to a sentence per task", () => {
    expect(friendlyJobError("autopilot", new Error("boom"))).toBe("A busca diária não terminou.");
    expect(friendlyJobError("send", new Error("SMTP destinatário: 550"))).toBe(
      "Não foi possível enviar o último e-mail.",
    );
  });
});

describe("jobState", () => {
  it.each([
    [
      "switched off wins over failures",
      "send",
      run({ consecutiveFailures: 5 }),
      true,
      "off",
      "off",
    ],
    ["never ran", "send", undefined, false, "off", "never"],
    ["last run worked", "send", run(), false, "ok", "ok"],
    ["one failure", "inbox", run({ consecutiveFailures: 1 }), false, "warning", "failing"],
    ["two failures", "inbox", run({ consecutiveFailures: 2 }), false, "warning", "failing"],
    [
      "three failures in a row",
      "inbox",
      run({ consecutiveFailures: 3 }),
      false,
      "error",
      "failing",
    ],
    [
      "send missed 3 min (interval 1)",
      "send",
      run({ lastRunAt: minutesAgo(3) }),
      false,
      "warning",
      "stale",
    ],
    ["send ran 2 min ago", "send", run({ lastRunAt: minutesAgo(2) }), false, "ok", "ok"],
    [
      "inbox ran 9 min ago (interval 5)",
      "inbox",
      run({ lastRunAt: minutesAgo(9) }),
      false,
      "ok",
      "ok",
    ],
    ["inbox missed 11 min", "inbox", run({ lastRunAt: minutesAgo(11) }), false, "warning", "stale"],
    [
      "autopilot ran 90 min ago (hourly)",
      "autopilot",
      run({ lastRunAt: minutesAgo(90) }),
      false,
      "ok",
      "ok",
    ],
    [
      "autopilot missed 3 h",
      "autopilot",
      run({ lastRunAt: minutesAgo(180) }),
      false,
      "warning",
      "stale",
    ],
    [
      "queue has no schedule",
      "analysis-queue",
      run({ lastRunAt: minutesAgo(10_000) }),
      false,
      "ok",
      "ok",
    ],
  ] as const)("%s", (_name, job, info, off, state, reason) => {
    expect(jobState(job, info, { now, off })).toEqual({ state, reason });
  });
});

describe("needsAttention", () => {
  it("is true only for a task in error that failed within 24 hours", () => {
    expect(needsAttention([{ state: "error", lastErrorAt: minutesAgo(30) }], now)).toBe(true);
    expect(needsAttention([{ state: "error", lastErrorAt: minutesAgo(25 * 60) }], now)).toBe(false);
    expect(needsAttention([{ state: "warning", lastErrorAt: minutesAgo(1) }], now)).toBe(false);
    expect(needsAttention([{ state: "off", lastErrorAt: minutesAgo(1) }], now)).toBe(false);
    expect(needsAttention([], now)).toBe(false);
  });
});

describe("timeAgo", () => {
  it.each([
    [0, "agora"],
    [3, "há 3 min"],
    [59, "há 59 min"],
    [60, "há 1 h"],
    [23 * 60 + 59, "há 23 h"],
    [24 * 60, "há 1 dia"],
    [72 * 60, "há 3 dias"],
    [-5, "agora"],
  ])("%i min → %s", (minutes, expected) => {
    expect(timeAgo(minutesAgo(minutes), now)).toBe(expected);
  });
});

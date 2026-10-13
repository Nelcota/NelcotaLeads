/** The background tasks whose health Conta → Status shows, in the order it lists them. */
export const JOBS = [
  "send",
  "inbox",
  "follow-ups",
  "auto-dispatch",
  "autopilot",
  "analysis-queue",
] as const;
export type Job = (typeof JOBS)[number];

export const JOB_LABELS: Record<Job, string> = {
  send: "Envio de e-mails",
  inbox: "Leitura da caixa",
  "follow-ups": "Retornos automáticos",
  "auto-dispatch": "Envio automático",
  autopilot: "Busca diária",
  "analysis-queue": "Análise das empresas",
};

/** How often the cron runs each task; null for the queue, which only runs when there is work. */
export const JOB_INTERVAL_MINUTES: Record<Job, number | null> = {
  send: 1,
  inbox: 5,
  "follow-ups": 5,
  "auto-dispatch": 60,
  autopilot: 60,
  "analysis-queue": null,
};

/** Failures in a row that turn a task from orange to red. */
export const ERROR_AFTER_FAILURES = 3;

export const MAILBOX_REFUSED =
  "A caixa de e-mail recusou a conexão. Confira a senha em Configurações.";
export const GOOGLE_LIMIT = "O limite diário do Google acabou.";

const JOB_FALLBACK: Record<Job, string> = {
  send: "Não foi possível enviar o último e-mail.",
  inbox: "Não foi possível ler a caixa de e-mail.",
  "follow-ups": "Não foi possível preparar os retornos.",
  "auto-dispatch": "Não foi possível preparar o envio automático.",
  autopilot: "A busca diária não terminou.",
  "analysis-queue": "A análise de algumas empresas falhou. Peça uma nova análise no lead.",
};

/**
 * What the user reads about a failed task: one of a few fixed sentences, never the error's own
 * text (that stays in the log).
 */
export function friendlyJobError(job: Job, error: unknown): string {
  const text = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/limite diário de requisições ao google|google.*(429|quota|resource_exhausted)/i.test(text)) {
    return GOOGLE_LIMIT;
  }
  if (
    /^(smtp|imap)\b|servidor de e-mail|econnrefused|connection refused|tls|socket/i.test(text) &&
    !/^smtp destinat/i.test(text)
  ) {
    return MAILBOX_REFUSED;
  }
  return JOB_FALLBACK[job];
}

/** A rejected recipient is a problem of that one e-mail (shown on it), not of the mailbox. */
export function isRecipientRejection(error: unknown): boolean {
  return error instanceof Error && /^smtp destinat/i.test(error.message);
}

export type JobState = "ok" | "warning" | "error" | "off";

/** Why a task has its state, for the line under its name. */
export type JobReason = "ok" | "failing" | "stale" | "never" | "off";

export type JobRunInfo = {
  lastRunAt: Date;
  lastOkAt: Date | null;
  lastErrorAt: Date | null;
  consecutiveFailures: number;
};

/**
 * The state of one task: `off` when it is switched off or never ran, `error` after
 * {@link ERROR_AFTER_FAILURES} failures in a row, `warning` after one failure or when the cron
 * missed more than twice its interval, `ok` otherwise.
 */
export function jobState(
  job: Job,
  run: JobRunInfo | undefined,
  { now, off }: { now: Date; off: boolean },
): { state: JobState; reason: JobReason } {
  if (off) return { state: "off", reason: "off" };
  if (!run) return { state: "off", reason: "never" };
  if (run.consecutiveFailures >= ERROR_AFTER_FAILURES) return { state: "error", reason: "failing" };
  if (run.consecutiveFailures > 0) return { state: "warning", reason: "failing" };
  const interval = JOB_INTERVAL_MINUTES[job];
  if (interval !== null && now.getTime() - run.lastRunAt.getTime() > 2 * interval * 60_000) {
    return { state: "warning", reason: "stale" };
  }
  return { state: "ok", reason: "ok" };
}

const DAY_MS = 24 * 60 * 60_000;

/** The sidebar dot: a task in `error` that failed within the last 24 hours. */
export function needsAttention(
  jobs: { state: JobState; lastErrorAt: Date | null }[],
  now: Date,
): boolean {
  return jobs.some(
    (job) =>
      job.state === "error" &&
      job.lastErrorAt !== null &&
      now.getTime() - job.lastErrorAt.getTime() < DAY_MS,
  );
}

/** "agora", "há 3 min", "há 2 h", "há 4 dias". */
export function timeAgo(date: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "há 1 dia" : `há ${days} dias`;
}

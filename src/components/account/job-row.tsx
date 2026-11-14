import { Button } from "@/components/ui/button";
import { useJobRetry } from "@/hooks/use-job-retry";
import { JOB_LABELS, timeAgo, type Job } from "@/lib/system-status";
import type { JobStatus } from "@/server/job-runs";
import { JobStateIcon } from "./job-state-icon";
import { SettingsRow } from "./settings-row";

function detail(job: JobStatus): string | null {
  if (job.reason === "failing") return job.error ?? "A última execução falhou.";
  if (job.reason === "stale") return "O agendamento não roda há algum tempo.";
  if (job.reason === "never") return "Ainda não rodou.";
  if (job.reason === "off") return offReason(job.job);
  return null;
}

function offReason(job: Job): string {
  if (job === "autopilot") return "Busca diária desligada.";
  if (job === "auto-dispatch") return "Disparo automático desligado.";
  return "E-mail não conectado.";
}

/** One background task: its state, when it last ran and, while failing, "Tentar agora". */
export function JobRow({ job, now }: { job: JobStatus; now: Date }) {
  const retry = useJobRetry(job.job);
  const text = detail(job);
  const ran = job.lastRunAt && job.state !== "off" ? timeAgo(new Date(job.lastRunAt), now) : null;
  const canRetry = job.reason === "failing" && retry !== null;

  return (
    <SettingsRow
      data-job={job.job}
      className="min-h-12 pl-1"
      action={
        <>
          {ran ? <span className="text-sm text-muted-foreground tabular-nums">{ran}</span> : null}
          {canRetry ? (
            <Button variant="outline" size="sm" disabled={retry.retrying} onClick={retry.retry}>
              {retry.retrying ? "Tentando…" : "Tentar agora"}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex items-start gap-3">
        <JobStateIcon state={job.state} className="mt-0.5" />
        <div className="grid min-w-0">
          <span>{JOB_LABELS[job.job]}</span>
          {text ? <span className="text-sm text-muted-foreground">{text}</span> : null}
        </div>
      </div>
    </SettingsRow>
  );
}

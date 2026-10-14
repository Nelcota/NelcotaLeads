import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GroupedRow, Hint, SectionHeader, TONE_TEXT, type Tone } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { errorToast } from "@/lib/mutation-toasts";
import { systemStatusQuery } from "@/lib/queries";
import { JOB_LABELS, timeAgo, type Job, type JobState } from "@/lib/system-status";
import { cn } from "@/lib/utils";
import { runAutopilotNow } from "@/server/dashboard";
import { checkMailNow } from "@/server/mail";
import type { JobStatus } from "@/server/job-runs";

const STATE_TONE: Record<JobState, Tone> = {
  ok: "green",
  warning: "orange",
  error: "red",
  off: "gray",
};

const STATE_LABEL: Record<JobState, string> = {
  ok: "Funcionando",
  warning: "Atenção",
  error: "Falhando",
  off: "Desligado",
};

/** The task's own manual run, reused as "Tentar agora"; tasks without one get no button. */
const RETRY: Partial<Record<Job, () => Promise<unknown>>> = {
  send: () => checkMailNow(),
  inbox: () => checkMailNow(),
  autopilot: () => runAutopilotNow(),
};

function detail(job: JobStatus): { text: string; tone?: Tone } | null {
  switch (job.reason) {
    case "failing":
      return { text: job.error ?? "A última execução falhou.", tone: STATE_TONE[job.state] };
    case "stale":
      return { text: "O agendamento não roda há algum tempo.", tone: "orange" };
    case "never":
      return { text: "Ainda não rodou." };
    case "off":
      return { text: offReason(job.job) };
    default:
      return null;
  }
}

function offReason(job: Job) {
  if (job === "autopilot") return "Busca diária desligada.";
  if (job === "auto-dispatch") return "Disparo automático desligado.";
  return "Caixa de e-mail não conectada.";
}

/** Conta → Status: one row per background task, refreshed every minute while open. */
export function SystemStatusSection() {
  const { data: jobs, dataUpdatedAt } = useQuery(systemStatusQuery);
  // "há 3 min" counts from the last refresh (every minute), the same on the server and client.
  const now = new Date(dataUpdatedAt);
  return (
    <section id="status" className="enter min-w-0 scroll-mt-4">
      <SectionHeader
        title="Status"
        hint={
          // The local dev server has no cron: tasks only run through "Tentar agora".
          import.meta.env.DEV
            ? "Neste computador as tarefas só rodam quando você pede."
            : "Tarefas que rodam sozinhas."
        }
      />
      <div className="grouped">
        {(jobs ?? []).map((job) => (
          <JobRow key={job.job} job={job} now={now} />
        ))}
      </div>
    </section>
  );
}

function JobRow({ job, now }: { job: JobStatus; now: Date }) {
  const queryClient = useQueryClient();
  const retry = RETRY[job.job];
  const mutation = useMutation({
    mutationFn: () => (retry ? retry() : Promise.resolve()),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: systemStatusQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: ["provider-status"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      ]),
    // The row itself shows the new state, so success needs no toast.
    onError: errorToast("Não foi possível tentar agora"),
  });
  const tone = STATE_TONE[job.state];
  const info = detail(job);
  const failing = job.reason === "failing";
  return (
    <GroupedRow
      inset={40}
      data-job={job.job}
      lead={
        <Hint label={STATE_LABEL[job.state]}>
          <span
            role="img"
            aria-label={STATE_LABEL[job.state]}
            className={cn("block size-2.5 rounded-full bg-current", TONE_TEXT[tone])}
          />
        </Hint>
      }
      title={JOB_LABELS[job.job]}
      subtitle={info?.text}
      subtitleTone={info?.tone}
      className="[&_.truncate]:whitespace-normal"
      trailing={
        <div className="flex shrink-0 items-center gap-3">
          {job.lastRunAt && job.state !== "off" ? (
            <span className="text-[12.5px] font-light text-muted-foreground tabular-nums">
              {timeAgo(job.lastRunAt, now)}
            </span>
          ) : null}
          {failing && retry ? (
            <Button
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Tentando…" : "Tentar agora"}
            </Button>
          ) : null}
        </div>
      }
    />
  );
}

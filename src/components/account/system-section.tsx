import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SystemSummary } from "@/lib/system-status";
import type { JobStatus } from "@/server/job-runs";
import { JobRow } from "./job-row";
import { JobStateIcon } from "./job-state-icon";
import { SettingsRow } from "./settings-row";
import { SettingsSection } from "./settings-section";

export type TodayUsage = { mailSent: number; mailLimit: number; google: string };

/**
 * "Sistema": one line with the worst state of the background tasks, "Ver tarefas" opens the six
 * of them, then today's usage. Keeps the `#status` anchor the help links to.
 */
export function SystemSection({
  summary,
  jobs,
  now,
  usage,
  open,
  onToggle,
}: {
  summary: SystemSummary | null;
  jobs: JobStatus[];
  now: Date;
  usage: TodayUsage | null;
  open: boolean;
  onToggle: () => void;
}) {
  // The local dev server has no cron: tasks only run through "Tentar agora".
  const description = import.meta.env.DEV
    ? "Neste computador as tarefas só rodam quando você pede."
    : "Tarefas que rodam sozinhas e o uso de hoje.";

  return (
    <SettingsSection id="status" title="Sistema" description={description}>
      {summary ? (
        <SettingsRow
          action={
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={open}
              aria-controls="system-jobs"
              onClick={onToggle}
            >
              {open ? "Ocultar tarefas" : "Ver tarefas"}
            </Button>
          }
        >
          <div className="flex items-center gap-3">
            <JobStateIcon state={summary.state} />
            <span>
              <span className="font-medium">{summary.title}</span>
              <span className="text-muted-foreground"> · {summary.detail}</span>
            </span>
          </div>
        </SettingsRow>
      ) : null}
      {/* Slides its height open (none under reduced motion); closed, it is out of the tab order. */}
      <div
        id="system-jobs"
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="settings-jobs min-h-0 overflow-hidden">
          {jobs.map((job) => (
            <JobRow key={job.job} job={job} now={now} />
          ))}
        </div>
      </div>
      {usage ? (
        <>
          <SettingsRow id="uso" label="E-mails enviados hoje" className="scroll-mt-4">
            <span className="tabular-nums">{usage.mailSent}</span>{" "}
            <span className="text-muted-foreground">de {usage.mailLimit}</span>
          </SettingsRow>
          <SettingsRow label="Buscas no Google">{usage.google}</SettingsRow>
        </>
      ) : null}
    </SettingsSection>
  );
}

import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, MailIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { JobStateIcon } from "@/components/account/job-state-icon";
import { Skeleton } from "@/components/ui/skeleton";
import type { SettingsSummary } from "@/hooks/use-settings-summary";
import { formatCount, formatUsd } from "@/lib/format";
import { SettingsBlock } from "./settings-block";
import { SettingsLine } from "./settings-line";

// Same size and tone as the task state icon beside them.
const ICON = "size-[18px] shrink-0 text-muted-foreground";

/** "Consumo" on the Resumo tab: today's e-mails and Google searches, the month's AI spend. */
export function UsageBlock({
  usage,
  system,
}: {
  usage: SettingsSummary["usage"];
  system: SettingsSummary["system"];
}) {
  return (
    <SettingsBlock
      id="consumo"
      title="Consumo"
      description="O que já foi usado hoje e neste mês."
      action={
        <Link
          to="/conta"
          hash="status"
          className="inline-flex min-h-6 items-center gap-1 text-sm font-medium text-blue hover:underline"
        >
          Ver tarefas do sistema
          <ChevronRightIcon aria-hidden className="size-4" />
        </Link>
      }
    >
      {usage ? (
        <>
          <SettingsLine
            icon={<MailIcon aria-hidden className={ICON} />}
            label="E-mails enviados hoje"
            value={`${formatCount(usage.mailSent)} de ${formatCount(usage.mailLimit)}`}
          />
          <SettingsLine
            icon={<SearchIcon aria-hidden className={ICON} />}
            label="Empresas buscadas no Google hoje"
            value={`${formatCount(usage.companiesUsed)} de ${formatCount(usage.companiesLimit)}`}
          />
          <SettingsLine
            icon={<SparklesIcon aria-hidden className={ICON} />}
            label="Custo de IA neste mês"
            value={usage.aiMonthUsd === null ? "—" : formatUsd(usage.aiMonthUsd)}
          />
          {system ? (
            <SettingsLine
              icon={<JobStateIcon state={system.state} />}
              label={system.title}
              sub={system.detail}
            />
          ) : null}
        </>
      ) : (
        <div role="status" aria-label="Carregando o consumo" className="grid gap-3">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      )}
    </SettingsBlock>
  );
}

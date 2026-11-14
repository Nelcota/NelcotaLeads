import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CircleAlertIcon, RotateCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Hint, toneVar, type Tone } from "@/components/apple-ui";
import { GoogleQuotaRow } from "@/components/google-quota-row";
import { Button } from "@/components/ui/button";
import { useSidebarStatus } from "@/hooks/use-sidebar-status";
import { GLOSSARY } from "@/lib/help";
import type { SidebarStatus } from "@/lib/sidebar-status";
import type { getProviderStatus } from "@/server/searches";

type ProviderStatus = Awaited<ReturnType<typeof getProviderStatus>>;

/**
 * The one card at the bottom of the sidebar: a problem that stops the work first (no mailbox,
 * a failing automatic task, a status that could not be read), otherwise today's usage. Hidden
 * in icon mode; the status dot on top still shows a problem there.
 */
export function SidebarStatusCard() {
  const { data, status, retrying, retry } = useSidebarStatus();
  const content = statusContent(status, data, { retrying, retry });
  if (!content) return null;

  return (
    <section
      aria-label="Situação de hoje"
      className="grid gap-3 rounded-[14px] border border-foreground/8 bg-card p-3.5 group-data-[collapsible=icon]:hidden"
    >
      {content}
    </section>
  );
}

type Retry = { retrying: boolean; retry: () => Promise<void> };

/** The card for each status; nothing while the first answer is on its way. */
function statusContent(
  status: SidebarStatus,
  data: ProviderStatus | undefined,
  { retrying, retry }: Retry,
): ReactNode {
  if (status === "loading") return null;
  if (status === "unavailable") {
    return (
      <StatusAlert
        title="Situação indisponível"
        text="Não deu para verificar o e-mail e as tarefas automáticas."
        action={
          <button type="button" onClick={() => void retry()} disabled={retrying}>
            <RotateCwIcon
              aria-hidden
              className={retrying ? "animate-spin motion-reduce:animate-none" : undefined}
            />
            Tentar de novo
          </button>
        }
      />
    );
  }
  if (status === "mail") {
    return withQuota(
      data,
      <StatusAlert
        title="E-mail não conectado"
        text="Os disparos ficam parados até a caixa voltar."
        action={
          <Link to="/settings" hash="email">
            Ver configurações
            <ArrowRightIcon aria-hidden />
          </Link>
        }
      />,
    );
  }
  if (status === "system") {
    return withQuota(
      data,
      <StatusAlert
        title="Algo precisa de atenção"
        text="Uma tarefa automática está falhando."
        action={
          <Link to="/conta" hash="status">
            Ver status
            <ArrowRightIcon aria-hidden />
          </Link>
        }
      />,
    );
  }
  if (!data) return null;
  return <UsageMeters data={data} />;
}

/** An alert keeps the Google search quota under it: searching works without a mailbox. */
function withQuota(data: ProviderStatus | undefined, alert: ReactNode): ReactNode {
  if (!data) return alert;
  return (
    <>
      {alert}
      <GoogleQuotaRow usage={data.placesUsage} />
    </>
  );
}

function UsageMeters({ data }: { data: ProviderStatus }) {
  return (
    <>
      <MeterRow
        value={percent(data.mail.sentToday, data.mail.limit)}
        tone="blue"
        used={data.mail.sentToday}
        limit={data.mail.limit}
        label="e-mails hoje"
        info={GLOSSARY.dailyLimit.text}
      />
      <GoogleQuotaRow usage={data.placesUsage} />
    </>
  );
}

function StatusAlert({ title, text, action }: { title: string; text: string; action: ReactNode }) {
  return (
    <div className="grid gap-2.5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CircleAlertIcon aria-hidden className="size-[18px] shrink-0 text-orange" />
        {title}
      </p>
      <p className="text-xs text-muted-foreground">{text}</p>
      <Button asChild variant="outline" size="sm" className="justify-self-start">
        {action}
      </Button>
    </div>
  );
}

function percent(used: number, limit: number) {
  if (limit <= 0) return 0;
  return (used / limit) * 100;
}

function MeterRow({
  value,
  tone,
  used,
  limit,
  label,
  info,
}: {
  value: number;
  tone: Tone;
  used: number;
  limit: number;
  label: string;
  /** Explains the limit in a tooltip on the meter itself (hover or keyboard focus). */
  info: string;
}) {
  return (
    <Hint
      label={<span className="block max-w-64 font-normal leading-snug">{info}</span>}
      side="right"
    >
      <div
        tabIndex={0}
        role="group"
        aria-label={`${used} de ${limit} ${label}`}
        className="grid gap-1.5 rounded-[9px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <div className="flex items-baseline justify-between gap-2 text-sm leading-tight">
          <span className="text-muted-foreground first-letter:uppercase">{label}</span>
          <span className="font-semibold tabular-nums">
            {used} de {limit}
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-fill-2" aria-hidden>
          <div
            className="bar-grow h-full rounded-full"
            style={{ width: `${Math.min(value, 100)}%`, background: toneVar(tone) }}
          />
        </div>
      </div>
    </Hint>
  );
}

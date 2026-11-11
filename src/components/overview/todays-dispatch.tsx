import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  PlayIcon,
  RefreshCwIcon,
  Undo2Icon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { StatusLabel } from "@/components/status-label";
import { Button } from "@/components/ui/button";
import { shortTime } from "@/lib/format";
import { errorToast } from "@/lib/mutation-toasts";
import { dispatchRunState, nextSendTime } from "@/lib/overview";
import { SEND_GAP_MINUTES } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { runAutopilotNow, type Dashboard } from "@/server/dashboard";
import { checkMailNow } from "@/server/mail";
import { DispatchControls } from "./dispatch-controls";

type SendRow = {
  key: string;
  leadId: string;
  time: string;
  name: string;
  detail: string;
  status: SendStatus;
};

type SendStatus = "Na fila" | "Enviado" | "Voltou" | "Falhou";

const STATUS_VARIANT = {
  "Na fila": "gray",
  Enviado: "green",
  Voltou: "orange",
  Falhou: "red",
} as const;

const STATUS_ICON: Record<SendStatus, LucideIcon> = {
  "Na fila": ClockIcon,
  Enviado: CircleCheckIcon,
  Voltou: Undo2Icon,
  Falhou: CircleXIcon,
};

/** The run state's icon: a problem, running, or waiting. */
const RUN_ICON: Record<"green" | "orange" | "gray", LucideIcon> = {
  green: CircleCheckIcon,
  orange: CircleAlertIcon,
  gray: ClockIcon,
};

const SEND_STATUS = { sent: "Enviado", bounced: "Voltou", failed: "Falhou" } as const;

function sendRows(data: Dashboard): SendRow[] {
  const { nextQueued, recentSends } = data.mail;
  const queued: SendRow[] = nextQueued
    ? [
        {
          key: nextQueued.id,
          leadId: nextQueued.leadId,
          time: nextQueued.at ? queuedTime(data, nextQueued.at) : "agora",
          name: nextQueued.name,
          detail: [nextQueued.niche, nextQueued.to].filter(Boolean).join(" · "),
          status: "Na fila",
        },
      ]
    : [];
  const done = recentSends.map((send): SendRow => ({
    key: send.id,
    leadId: send.leadId,
    time: shortTime(send.at, data.today),
    name: send.name,
    detail: [send.niche, send.to].filter(Boolean).join(" · "),
    status: SEND_STATUS[send.status],
  }));
  return [...queued, ...done];
}

/** A queued slot as it will really go out: never in the past, inside the window. */
function queuedTime(data: Dashboard, at: Date) {
  const next = nextSendTime({ ...data.mail, nextSendAt: at }, data.now);
  return next ? shortTime(next, data.today) : "agora";
}

function nextSendText(data: Dashboard) {
  const { mail } = data;
  if (mail.paused) return "Pausado: primeiros e-mails e retornos esperam até alguém retomar.";
  const next = nextSendTime(mail, data.now);
  if (!next) return "Nenhum e-mail na fila agora.";
  const when = `Próximo envio às ${shortTime(next, data.today)}`;
  // The rest of the daily limit is kept for conversation replies (see coldDailyLimit).
  if (mail.sentToday >= mail.coldLimit) return `Limite do dia atingido. ${when}`;
  return when;
}

/** Today's sending: how far the daily limit went, what is queued, and the last sends. */
export function TodaysDispatch({ data }: { data: Dashboard }) {
  const { mail } = data;
  const state = dispatchRunState(mail, data.now);
  const share = mail.limit > 0 ? Math.min(100, (mail.sentToday / mail.limit) * 100) : 0;
  const rows = sendRows(data);
  return (
    <section
      aria-labelledby="todays-dispatch"
      className="grouped enter grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <h2 id="todays-dispatch" className="text-lg font-semibold">
            Disparo de hoje
          </h2>
          <StatusLabel icon={RUN_ICON[state.variant]} tone={state.variant}>
            {state.label}
          </StatusLabel>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl leading-none font-semibold tracking-[-0.03em] tabular-nums">
            {mail.sentToday}
          </span>
          <span className="text-muted-foreground">de {mail.limit} e-mails</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-fill-2" aria-hidden>
          <div className="bar-grow h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">{nextSendText(data)}</p>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Counter label="Enviados" value={mail.sentToday} />
          <Counter label="Na fila" value={mail.queued} />
          <Counter
            label="Voltaram"
            value={mail.bouncedToday}
            tone={mail.bouncedToday > 0 ? "orange" : undefined}
          />
          <Counter
            label="Falharam"
            value={mail.failedToday}
            tone={mail.failedToday > 0 ? "red" : undefined}
          />
        </dl>
        {mail.configured ? (
          <DispatchControls paused={mail.paused} cancellable={mail.cancellable} />
        ) : null}
        <DispatchActions data={data} />
        <div className="flex items-center gap-3 border-t border-border/60 pt-3">
          <p className="flex-1 text-sm text-tertiary">
            Ordem: nota mais alta primeiro · das {mail.windowStart}h às {mail.windowEnd}h · um
            e-mail a cada {SEND_GAP_MINUTES} min · IA responde sozinha{" "}
            {mail.aiAutoReply ? "ligada" : "desligada"} · disparo automático{" "}
            {mail.autoDispatch ? "ligado" : "desligado"}
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link to="/settings" hash="piloto">
              Ajustar
            </Link>
          </Button>
        </div>
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2 pb-2">
          <h3 className="flex-1 text-base font-semibold">Últimos envios</h3>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/conversas">Ver conversas</Link>
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="border-t border-border/60 py-4 text-sm text-muted-foreground">
            Nenhum envio hoje.
          </p>
        ) : (
          rows.map((row) => (
            <Link
              key={row.key}
              to="/conversas"
              search={{ lead: row.leadId }}
              className="grid min-h-[50px] grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-t border-border/60 transition-colors outline-none hover:bg-fill-3 focus-visible:bg-fill-2"
            >
              <span className="text-sm text-tertiary tabular-nums">{row.time}</span>
              <span className="grid min-w-0">
                <span className="truncate font-semibold">{row.name}</span>
                <span className="truncate text-sm text-tertiary">{row.detail}</span>
              </span>
              <StatusLabel icon={STATUS_ICON[row.status]} tone={STATUS_VARIANT[row.status]}>
                {row.status}
              </StatusLabel>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

const COUNTER_TONE = { red: "text-red", orange: "text-orange" } as const;

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: keyof typeof COUNTER_TONE;
}) {
  return (
    <div className="rounded-[14px] bg-card-2 px-3 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("text-lg font-semibold tabular-nums", tone && COUNTER_TONE[tone])}>
        {value}
      </dd>
    </div>
  );
}

/** Check the mailbox now and run the daily search now, without waiting for the schedule. */
function DispatchActions({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
    ]);
  const check = useMutation({
    mutationFn: () => checkMailNow(),
    onSuccess: async (result) => {
      await refresh();
      toast.success(
        result.received > 0
          ? `${result.received} ${result.received === 1 ? "resposta nova" : "respostas novas"}`
          : "Nenhuma resposta nova",
      );
    },
    onError: errorToast("Não foi possível verificar os e-mails"),
  });
  const runNow = useMutation({
    mutationFn: () => runAutopilotNow(),
    onSuccess: async (result) => {
      await refresh();
      toast.success(
        result.searches > 0
          ? `${result.searches} ${result.searches === 1 ? "busca feita" : "buscas feitas"}`
          : "Nada para buscar agora",
      );
    },
    onError: errorToast("Não foi possível buscar agora"),
  });
  const canSearch = data.autopilot.targets.length > 0 && data.setup.keys;
  if (!data.mail.configured && !canSearch) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {data.mail.configured ? (
        <Button variant="outline" onClick={() => check.mutate()} disabled={check.isPending}>
          <RefreshCwIcon />
          {check.isPending ? "Verificando…" : "Verificar respostas"}
        </Button>
      ) : null}
      {canSearch ? (
        <Button variant="outline" onClick={() => runNow.mutate()} disabled={runNow.isPending}>
          <PlayIcon />
          {runNow.isPending ? "Buscando…" : "Rodar busca diária"}
        </Button>
      ) : null}
    </div>
  );
}

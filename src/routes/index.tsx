import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useOpenNewSearch } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { addDays, formatIsoLocal, localDay, relativeDay } from "@/lib/format";
import { whatsappLink } from "@/lib/phone";
import { dashboardQuery } from "@/lib/queries";
import type { LeadView } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import {
  draftFollowUpsNow,
  runAutopilotNow,
  setAutopilotEnabled,
  writeMissingMessages,
  type Dashboard,
} from "@/server/dashboard";
import { updateFirstMessage, updateFollowUpMessage, updateLead } from "@/server/leads";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: DashboardPage,
});

type ReadyLead = Dashboard["ready"][number];
type FollowUpLead = Dashboard["followUps"][number];

const FOLLOW_UP_DAYS = 3;
const REMINDER_GAP_DAYS = 4;

function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
    ]);
}

function DashboardPage() {
  const { data } = useQuery(dashboardQuery);
  if (!data) return <DashboardSkeleton />;

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-6 pb-16 sm:px-8 sm:pt-8">
      <AutopilotStrip data={data} />
      {!data.setup.offer ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-foreground/20 px-5 py-4">
          <p className="max-w-2xl text-[15px]">
            Falta dizer o que você vende. Sem isso a IA não escreve mensagens, porque não teria o
            que oferecer, e a nota fica genérica.
          </p>
          <Button asChild>
            <Link to="/settings">Descrever o que eu vendo</Link>
          </Button>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <div className="grid min-w-0 flex-[999_1_600px] grid-cols-[minmax(0,1fr)] gap-4">
          <ReadySection data={data} />
          {data.followUps.length > 0 ? <FollowUpSection data={data} /> : null}
        </div>
        <aside className="grid min-w-0 flex-[1_1_320px] grid-cols-[minmax(0,1fr)] gap-4">
          <ActivityCard data={data} />
          <FunnelCard data={data} />
          <CostCard data={data} />
        </aside>
      </div>
    </div>
  );
}

function AutopilotStrip({ data }: { data: Dashboard }) {
  const refresh = useRefresh();
  const { autopilot } = data;
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setAutopilotEnabled({ data: { enabled } }),
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível mudar o piloto automático"),
  });
  const runNow = useMutation({
    mutationFn: () => runAutopilotNow(),
    onSuccess: async (result) => {
      await refresh();
      toast.success(
        result.searches > 0
          ? `${result.searches} ${result.searches === 1 ? "busca feita" : "buscas feitas"}. A IA está analisando.`
          : "Nada para buscar agora.",
      );
    },
    onError: (error) => toast.error(error.message || "Não foi possível buscar agora"),
  });

  const enabled = toggle.isPending ? toggle.variables : autopilot.enabled;
  const targets = autopilot.targets.map((target) => `${target.niche} em ${target.city}`);
  const ranToday = autopilot.lastRunOn === data.today;

  return (
    <section className="flex flex-wrap items-center gap-x-7 gap-y-3 rounded-2xl bg-[#14161B] px-5 py-4 text-white dark:bg-[#1F2228]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Piloto automático"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate(!autopilot.enabled)}
          className={cn(
            "relative h-[26px] w-11 shrink-0 rounded-full transition-colors",
            enabled ? "bg-[#4ADE80]" : "bg-white/25",
          )}
        >
          <span
            className={cn(
              "absolute top-[3px] size-5 rounded-full bg-white transition-all",
              enabled ? "right-[3px]" : "left-[3px]",
            )}
          />
        </button>
        <span className="text-[17px] font-semibold">
          Piloto automático {enabled ? "ligado" : "desligado"}
        </span>
      </div>
      <span className="min-w-0 basis-full text-[15px] text-white/70 md:flex-1 md:basis-0">
        {targets.length === 0
          ? "Diga o que buscar e a IA traz leads novos todo dia."
          : `${ranToday ? "Buscou hoje" : `Busca todo dia às ${autopilot.hour}h`}: ${targets.join(", ")}`}
      </span>
      <div className="flex items-center gap-4">
        {targets.length > 0 ? (
          <button
            type="button"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending || !data.setup.keys}
            className="text-sm font-medium text-white/90 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {runNow.isPending ? "Buscando…" : "Buscar agora"}
          </button>
        ) : null}
        <Link
          to="/settings"
          hash="piloto"
          className="text-sm font-medium text-white underline-offset-4 hover:underline"
        >
          {targets.length === 0 ? "Configurar" : "Ajustar"}
        </Link>
      </div>
    </section>
  );
}

function ReadySection({ data }: { data: Dashboard }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openNewSearch = useOpenNewSearch();
  const ready = data.ready;
  const expandedId = ready.some((lead) => lead.id === openId) ? openId : ready[0]?.id;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-[26px] font-medium tracking-tight">
          Pronto para enviar <span className="text-muted-foreground">{ready.length}</span>
        </h1>
        {data.analyzing > 0 ? (
          <span className="text-sm text-muted-foreground" aria-live="polite">
            Analisando {data.analyzing} {data.analyzing === 1 ? "empresa" : "empresas"}…
          </span>
        ) : null}
      </div>

      {ready.length === 0 ? (
        <Card className="grid justify-items-start gap-3 p-6">
          <p className="text-[15px]">
            {!data.setup.offer
              ? "As mensagens aparecem aqui depois que você descrever o que vende."
              : data.analyzing > 0
                ? "A IA está lendo os sites e escrevendo as mensagens. Elas aparecem aqui em instantes."
                : data.autopilot.enabled && data.autopilot.targets.length > 0
                  ? `Nada pendente. A próxima busca é ${data.autopilot.lastRunOn === data.today ? "amanhã" : "hoje"} às ${data.autopilot.hour}h.`
                  : "Nada pendente. Ligue o piloto automático para receber leads todo dia, ou faça uma busca manual."}
          </p>
          {data.analyzing === 0 && data.setup.offer ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/settings" hash="piloto">
                  Configurar piloto automático
                </Link>
              </Button>
              <Button variant="ghost" onClick={openNewSearch}>
                Busca manual
              </Button>
            </div>
          ) : null}
        </Card>
      ) : (
        ready.map((lead) =>
          lead.id === expandedId ? (
            <ReadyCard key={`${lead.id}:${lead.firstMessage ?? ""}`} lead={lead} />
          ) : (
            <Card
              key={lead.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-semibold">{lead.name}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {[`Nota ${lead.score ?? "–"}`, lead.website ? null : "sem site", rating(lead)]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setOpenId(lead.id)}>
                Ver e enviar
              </Button>
            </Card>
          ),
        )
      )}
      {data.withoutMessage > 0 && data.setup.offer ? (
        <MissingMessages count={data.withoutMessage} />
      ) : null}
    </>
  );
}

function MissingMessages({ count }: { count: number }) {
  const refresh = useRefresh();
  const write = useMutation({
    mutationFn: () => writeMissingMessages(),
    onSuccess: async (result) => {
      await refresh();
      if (result.failed > 0) toast.error(`${result.failed} não puderam ser escritas agora.`);
    },
    onError: (error) => toast.error(error.message || "Não foi possível escrever as mensagens"),
  });
  return (
    <p className="text-sm text-muted-foreground">
      {count} {count === 1 ? "lead novo está" : "leads novos estão"} sem mensagem.{" "}
      <button
        type="button"
        onClick={() => write.mutate()}
        disabled={write.isPending}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {write.isPending ? "Escrevendo…" : "Escrever agora"}
      </button>
    </p>
  );
}

function ReadyCard({ lead }: { lead: ReadyLead }) {
  const refresh = useRefresh();
  const [message, setMessage] = useState(lead.firstMessage ?? "");
  const [editing, setEditing] = useState(false);
  const dirty = message !== (lead.firstMessage ?? "");

  const saveMessage = useMutation({
    mutationFn: () =>
      updateFirstMessage({ data: { analysisId: lead.analysisId, firstMessage: message } }),
    onError: () => toast.error("Não foi possível salvar a mensagem"),
  });
  const update = useMutation({
    mutationFn: (status: "new" | "contacted" | "discarded") =>
      updateLead({ data: { id: lead.id, status } }),
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível atualizar o lead"),
  });

  const markSent = () => {
    if (dirty) saveMessage.mutate();
    update.mutate("contacted", {
      onSuccess: () =>
        toast(`${lead.name}: contatado`, {
          description: `Retorno em ${FOLLOW_UP_DAYS} dias. A IA prepara o lembrete.`,
          action: { label: "Desfazer", onClick: () => update.mutate("new") },
        }),
    });
  };

  return (
    <Card className="grid gap-4 p-5 sm:p-6">
      <div className="flex justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[19px] leading-snug font-semibold">{lead.name}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {[lead.signals?.[0], rating(lead), lead.phone].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="text-[22px] font-semibold tabular-nums">{lead.score}</span>
      </div>

      {lead.summary ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{lead.summary}</p>
      ) : null}

      {editing ? (
        <Textarea
          aria-label={`Mensagem para ${lead.name}`}
          rows={5}
          autoFocus
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="bg-background px-4 py-3 text-[16px] leading-relaxed"
        />
      ) : (
        <p className="rounded-xl bg-muted px-4 py-3.5 text-[16px] leading-relaxed whitespace-pre-line">
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {lead.phoneE164 ? (
          <Button asChild disabled={update.isPending}>
            <a
              href={whatsappLink(lead.phoneE164, message)}
              target="_blank"
              rel="noreferrer"
              onClick={markSent}
            >
              Enviar no WhatsApp
            </a>
          </Button>
        ) : (
          <Button onClick={markSent} disabled={update.isPending}>
            Sem WhatsApp: marquei como contatado
          </Button>
        )}
        {editing ? (
          <Button
            variant="outline"
            onClick={() => {
              if (dirty) saveMessage.mutate();
              setEditing(false);
            }}
          >
            Pronto
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setEditing(true)}>
            Editar
          </Button>
        )}
        <Button
          variant="ghost"
          className="ml-auto text-muted-foreground"
          disabled={update.isPending}
          onClick={() => update.mutate("discarded")}
        >
          Não enviar
        </Button>
      </div>
    </Card>
  );
}

function FollowUpSection({ data }: { data: Dashboard }) {
  return (
    <>
      <h2 className="mt-4 text-xl font-medium tracking-tight">
        Retornos de hoje <span className="text-muted-foreground">{data.followUps.length}</span>
      </h2>
      {data.followUps.map((lead) => (
        <FollowUpCard
          key={`${lead.id}:${lead.followUpMessage ?? ""}`}
          lead={lead}
          today={data.today}
        />
      ))}
    </>
  );
}

function FollowUpCard({ lead, today }: { lead: FollowUpLead; today: string }) {
  const refresh = useRefresh();
  const draft =
    lead.followUpMessage && lead.followUpMessageFor === lead.followUpOn
      ? lead.followUpMessage
      : null;
  const [message, setMessage] = useState(draft ?? "");
  const [editing, setEditing] = useState(false);
  const waiting = lead.status === "contacted";

  const update = useMutation({
    mutationFn: (changes: { status?: "replied" | "closed" | "discarded"; followUpOn?: string }) =>
      updateLead({ data: { id: lead.id, ...changes } }),
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível atualizar o lead"),
  });
  const saveMessage = useMutation({
    mutationFn: () => updateFollowUpMessage({ data: { id: lead.id, message } }),
  });
  const writeNow = useMutation({
    mutationFn: () => draftFollowUpsNow(),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message || "Não foi possível escrever o lembrete"),
  });

  const sentReminder = () => {
    if (message !== (draft ?? "")) saveMessage.mutate();
    update.mutate(
      { followUpOn: addDays(today, REMINDER_GAP_DAYS) },
      {
        onSuccess: () =>
          toast(`${lead.name}: lembrete enviado`, {
            description: `Próximo retorno em ${REMINDER_GAP_DAYS} dias.`,
          }),
      },
    );
  };

  const contacted = lead.contactedAt ? localDay(lead.contactedAt) : null;
  const overdue = lead.followUpOn !== null && lead.followUpOn < today;

  return (
    <Card className="grid gap-4 p-5 sm:p-6">
      <div>
        <h3 className="text-[17px] font-semibold">{lead.name}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {waiting
            ? `Primeira mensagem ${contacted ? relativeDay(contacted, today) : ""}, sem resposta`
            : "Em conversa"}
          {overdue && lead.followUpOn
            ? ` · retorno era ${relativeDay(lead.followUpOn, today)}`
            : ""}
        </p>
      </div>

      {waiting ? (
        draft || editing ? (
          editing ? (
            <Textarea
              aria-label={`Lembrete para ${lead.name}`}
              rows={4}
              autoFocus
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="bg-background px-4 py-3 text-[16px] leading-relaxed"
            />
          ) : (
            <p className="rounded-xl bg-muted px-4 py-3.5 text-[16px] leading-relaxed whitespace-pre-line">
              {message}
            </p>
          )
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted px-4 py-3.5 text-sm text-muted-foreground">
            A IA escreve o lembrete na próxima hora.
            <button
              type="button"
              onClick={() => writeNow.mutate()}
              disabled={writeNow.isPending}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {writeNow.isPending ? "Escrevendo…" : "Escrever agora"}
            </button>
          </div>
        )
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {waiting ? (
          <>
            {lead.phoneE164 && message ? (
              <Button asChild disabled={update.isPending}>
                <a
                  href={whatsappLink(lead.phoneE164, message)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={sentReminder}
                >
                  Enviar lembrete
                </a>
              </Button>
            ) : null}
            {message && !editing ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Editar
              </Button>
            ) : null}
            <Button
              variant="outline"
              disabled={update.isPending}
              onClick={() => update.mutate({ status: "replied" })}
            >
              Respondeu
            </Button>
          </>
        ) : (
          <>
            {lead.phoneE164 ? (
              <Button asChild>
                <a href={whatsappLink(lead.phoneE164)} target="_blank" rel="noreferrer">
                  Abrir conversa
                </a>
              </Button>
            ) : null}
            <Button
              variant="outline"
              disabled={update.isPending}
              onClick={() => update.mutate({ status: "closed" })}
            >
              Fechou negócio
            </Button>
            <Button
              variant="outline"
              disabled={update.isPending}
              onClick={() => update.mutate({ followUpOn: addDays(today, FOLLOW_UP_DAYS) })}
            >
              Adiar {FOLLOW_UP_DAYS} dias
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          className="ml-auto text-muted-foreground"
          disabled={update.isPending}
          onClick={() => update.mutate({ status: "discarded" })}
        >
          Encerrar
        </Button>
      </div>
    </Card>
  );
}

function ActivityCard({ data }: { data: Dashboard }) {
  const { activity, setup } = data;
  const items: { time?: string; text: string }[] = [
    ...activity.searches.map((search) => ({
      time: formatIsoLocal(search.createdAt).slice(11, 16),
      text: `${search.origin === "autopilot" ? "Buscou" : "Você buscou"} ${search.niche} em ${search.city}: ${
        search.status === "error"
          ? "falhou"
          : `${search.foundCount} ${search.foundCount === 1 ? "empresa nova" : "empresas novas"}`
      }`,
    })),
    ...[
      activity.analyzed > 0 &&
        `Leu os sites e deu nota para ${activity.analyzed} ${activity.analyzed === 1 ? "empresa" : "empresas"}`,
      activity.messages > 0 &&
        `Escreveu ${activity.messages} ${activity.messages === 1 ? "mensagem" : "mensagens"}`,
      activity.discarded > 0 &&
        `Descartou ${activity.discarded} com nota abaixo de ${setup.minScore}`,
      activity.reminders > 0 &&
        `Preparou ${activity.reminders} ${activity.reminders === 1 ? "lembrete" : "lembretes"} de retorno`,
    ]
      .filter((text): text is string => Boolean(text))
      .map((text) => ({ text })),
  ];

  return (
    <Card className="px-5 py-4">
      <h2 className="mb-3.5 font-semibold">O que a IA fez hoje</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nada ainda hoje.</p>
      ) : (
        <ol className="grid gap-3 text-sm">
          {items.map((item) => (
            <li key={`${item.time ?? ""}${item.text}`} className="flex gap-3">
              <span className="w-10 shrink-0 text-muted-foreground tabular-nums">
                {item.time ?? ""}
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function FunnelCard({ data }: { data: Dashboard }) {
  const rows: { label: string; value: number; view: LeadView; muted?: boolean }[] = [
    { label: "Prontos para enviar", value: data.funnel.ready, view: "todo" },
    { label: "Aguardando resposta", value: data.funnel.waiting, view: "waiting" },
    { label: "Em conversa", value: data.funnel.talking, view: "talking" },
    { label: "Fechados", value: data.funnel.closed, view: "closed" },
    {
      label: "Descartados pela IA",
      value: data.funnel.aiDiscarded,
      view: "discarded",
      muted: true,
    },
  ];
  return (
    <Card className="px-5 py-4">
      <h2 className="mb-2 font-semibold">Funil</h2>
      <ul className="grid">
        {rows.map((row) => (
          <li key={row.label}>
            <Link
              to="/leads"
              search={{ view: row.view }}
              className={cn(
                "-mx-2 flex justify-between rounded-md px-2 py-1.5 text-[15px] hover:bg-muted",
                row.muted && "text-muted-foreground",
              )}
            >
              <span>{row.label}</span>
              <span className={cn("tabular-nums", !row.muted && "font-semibold")}>{row.value}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CostCard({ data }: { data: Dashboard }) {
  const { month, googleToday, googleLimit } = data.costs;
  return (
    <Card className="grid gap-1.5 px-5 py-4 text-sm text-muted-foreground">
      <h2 className="mb-1 font-semibold text-foreground">Custo do mês</h2>
      <p>Google: {month.placesRequests.toLocaleString("pt-BR")} de 1.000 requisições grátis</p>
      <p>IA: US$ {month.aiCostUsd.toFixed(2).replace(".", ",")}</p>
      <p>
        Hoje: {googleToday} de {googleLimit} requisições ao Google
      </p>
    </Card>
  );
}

function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-2xl border bg-card", className)}>{children}</section>;
}

function rating(lead: { rating: number | null; reviewCount: number | null }) {
  return lead.rating !== null
    ? `${lead.rating.toFixed(1).replace(".", ",")} no Google (${lead.reviewCount ?? 0})`
    : null;
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(0,1fr)] gap-6 px-4 pt-8 sm:px-8">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

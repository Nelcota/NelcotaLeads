import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  BotIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  PlayIcon,
  RefreshCwIcon,
  ReplyIcon,
  SearchIcon,
  SendIcon,
  Settings2Icon,
  SparklesIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import {
  Avatar,
  GroupedRow,
  IconTile,
  Lift,
  PropertyRow,
  SectionHeader,
  toneVar,
  type Tone,
} from "@/components/apple-ui";
import { Page, Stat, useOpenNewSearch } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { shortTime } from "@/lib/format";
import { dashboardQuery, leadCountsQuery } from "@/lib/queries";
import type { LeadFilters } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { runAutopilotNow, setAutomation, type Dashboard } from "@/server/dashboard";
import { checkMailNow } from "@/server/mail";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: OverviewPage,
});

function OverviewPage() {
  const { data } = useQuery(dashboardQuery);
  const openNewSearch = useOpenNewSearch();
  const actions = (
    <>
      <Button variant="outline" onClick={openNewSearch} aria-label="Buscar empresas">
        <SearchIcon />
        <span className="max-sm:hidden">Buscar empresas</span>
      </Button>
      <Button asChild>
        <Link to="/leads" search={{ view: "todo" }}>
          <SendIcon />
          <span className="sm:hidden">Disparar</span>
          <span className="max-sm:hidden">Selecionar e disparar</span>
        </Link>
      </Button>
    </>
  );

  if (!data) {
    return (
      <Page title="Visão geral" actions={actions}>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </Page>
    );
  }

  const empty = data.stats.leads === 0;
  return (
    <Page
      title="Visão geral"
      actions={actions}
      description={
        empty ? null : (
          <>
            <Stat value={data.stats.leads}>leads na base</Stat>
            {" · "}
            <Stat value={data.stats.readyToSend}>prontos para disparo</Stat>
            {data.attention.length > 0 ? (
              <>
                {" · "}
                <Stat value={data.attention.length} tone="orange">
                  precisam de você
                </Stat>
              </>
            ) : null}
          </>
        )
      }
    >
      <FirstSteps data={data} />
      <QuickActions data={data} />
      <Attention data={data} />
      {empty ? (
        <Automation data={data} />
      ) : (
        <>
          <Stats data={data} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Funnel data={data} />
            <Automation data={data} />
          </div>
          <Activity data={data} />
        </>
      )}
    </Page>
  );
}

/** Setup checklist, shown until the mailbox, the offer and the first search are in place. */
function FirstSteps({ data }: { data: Dashboard }) {
  const openNewSearch = useOpenNewSearch();
  const steps = [
    {
      done: data.mail.configured,
      title: "Conectar sua caixa de e-mail",
      hint: "É por ela que os e-mails saem e as respostas chegam.",
      action: (
        <Button asChild size="sm">
          <Link to="/settings" hash="email">
            Conectar
          </Link>
        </Button>
      ),
    },
    {
      done: data.setup.offer,
      title: "Contar o que você vende",
      hint: "A IA usa isso para escrever os e-mails.",
      action: (
        <Button asChild size="sm">
          <Link to="/settings" hash="oferta">
            Escrever
          </Link>
        </Button>
      ),
    },
    {
      done: data.stats.leads > 0,
      title: "Fazer a primeira busca",
      hint: "Encontre empresas no Google por nicho e cidade.",
      action: (
        <Button size="sm" onClick={openNewSearch}>
          Buscar
        </Button>
      ),
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  if (doneCount === steps.length) return null;
  const next = steps.findIndex((step) => !step.done);
  return (
    <section className="enter">
      <SectionHeader title="Primeiros passos" hint={`${doneCount} de ${steps.length} prontos`} />
      <div className="grouped">
        {steps.map((step, index) => (
          <GroupedRow
            key={step.title}
            inset={56}
            className={cn(step.done && "opacity-60")}
            lead={
              step.done ? (
                <span className="grid size-7 place-items-center rounded-full bg-green text-primary-foreground">
                  <CheckIcon className="size-4" strokeWidth={2.6} />
                </span>
              ) : (
                <span className="grid size-7 place-items-center rounded-full text-[13px] font-medium text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--text-quaternary)]">
                  {index + 1}
                </span>
              )
            }
            title={<span className={cn(step.done && "line-through")}>{step.title}</span>}
            subtitle={step.done ? "Pronto" : step.hint}
            trailing={!step.done && index === next ? step.action : null}
          />
        ))}
      </div>
    </section>
  );
}

type QuickAction = {
  key: string;
  icon: LucideIcon;
  tone: Tone;
  title: ReactNode;
  hint: string;
  busy?: boolean;
} & ({ search: LeadFilters } | { onClick: () => void });

/** One-click answers to what comes up every day: send, follow up, check replies, search. */
function QuickActions({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const openNewSearch = useOpenNewSearch();
  const { data: counts } = useQuery(leadCountsQuery({}));
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

  const ready = data.stats.readyToSend;
  const followUps = counts?.byView.followup ?? 0;
  const items: QuickAction[] = [];
  if (ready > 0 && data.mail.configured) {
    items.push({
      key: "dispatch",
      icon: SendIcon,
      tone: "blue",
      title: (
        <>
          Disparar para <b>{ready}</b> {ready === 1 ? "lead" : "leads"}
        </>
      ),
      hint: "Novos, com e-mail e já analisados",
      search: { view: "todo", hasEmail: true },
    });
  }
  if (followUps > 0) {
    items.push({
      key: "followup",
      icon: ClockIcon,
      tone: "orange",
      title: (
        <>
          Retornar <b>{followUps}</b> {followUps === 1 ? "lead" : "leads"}
        </>
      ),
      hint: "Retornos marcados para hoje ou atrasados",
      search: { view: "followup" },
    });
  }
  if (data.mail.configured) {
    items.push({
      key: "check",
      icon: RefreshCwIcon,
      tone: "green",
      title: check.isPending ? "Verificando…" : "Verificar respostas",
      hint: "Traz agora os e-mails novos da caixa",
      busy: check.isPending,
      onClick: () => check.mutate(),
    });
  }
  if (data.stats.leads > 0) {
    const autopilot = data.autopilot.targets.length > 0 && data.setup.keys;
    items.push({
      key: "search",
      icon: autopilot ? PlayIcon : SearchIcon,
      tone: "purple",
      title: autopilot
        ? runNow.isPending
          ? "Buscando…"
          : "Rodar busca diária"
        : "Buscar empresas",
      hint: autopilot
        ? "Busca agora os nichos do modo automático"
        : "Nova busca por nicho e cidade",
      busy: runNow.isPending,
      onClick: autopilot ? () => runNow.mutate() : openNewSearch,
    });
  }
  if (items.length === 0) return null;

  return (
    <section className="enter">
      <SectionHeader title="Ações rápidas" />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const body = (
            <>
              <IconTile icon={item.icon} tone={item.tone} size={32} />
              <span className="grid min-w-0 flex-1 text-left">
                <span className="truncate font-medium [&_b]:font-semibold [&_b]:tabular-nums">
                  {item.title}
                </span>
                <span className="truncate text-[12.5px] font-light text-muted-foreground">
                  {item.hint}
                </span>
              </span>
              <ChevronRightIcon className="row-chev size-4 shrink-0 text-quaternary" />
            </>
          );
          const className =
            "grouped row-hover press flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-fill-3 disabled:opacity-60";
          return "search" in item ? (
            <Link key={item.key} to="/leads" search={item.search} className={className}>
              {body}
            </Link>
          ) : (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              disabled={item.busy}
              className={className}
            >
              {body}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Attention({ data }: { data: Dashboard }) {
  const navigate = useNavigate();
  if (data.attention.length === 0) return null;
  return (
    <section className="enter">
      <SectionHeader
        title="Precisa de você"
        tone="orange"
        count={data.attention.length}
        hint="A IA parou nestas conversas e passou para você responder."
        action={
          <Link
            to="/conversas"
            search={{ filter: "needsYou" }}
            className="text-[12.5px] font-medium text-blue hover:underline"
          >
            Ver todas
          </Link>
        }
      />
      <div className="grouped">
        {data.attention.map((lead) => (
          <GroupedRow
            key={lead.id}
            role="link"
            tabIndex={0}
            className="cursor-pointer outline-none focus-visible:bg-fill-2"
            onClick={() => void navigate({ to: "/conversas", search: { lead: lead.id } })}
            onKeyDown={(event) => {
              if (event.key === "Enter")
                void navigate({ to: "/conversas", search: { lead: lead.id } });
            }}
            lead={<Avatar name={lead.name} />}
            title={lead.name}
            subtitle={lead.handoffReason ?? "Respondeu"}
            subtitleTone="orange"
            chevron
            trailing={
              <>
                <span className="text-[12.5px] font-medium text-blue max-sm:hidden">Responder</span>
                {lead.lastEmailAt ? (
                  <span className="text-[12.5px] text-tertiary tabular-nums">
                    {shortTime(lead.lastEmailAt)}
                  </span>
                ) : null}
              </>
            }
          />
        ))}
      </div>
    </section>
  );
}

type MetricItem = {
  label: string;
  value: number;
  hint: ReactNode;
  icon: LucideIcon;
  tone: Tone;
  to: "/conversas" | "/leads";
  search?: { view: "talking" | "all" };
};

function Stats({ data }: { data: Dashboard }) {
  const { stats, mail } = data;
  const navigate = useNavigate();
  const rate = stats.contacted > 0 ? Math.round((stats.replied / stats.contacted) * 100) : null;
  const items: MetricItem[] = [
    {
      label: "E-mails hoje",
      value: mail.sentToday,
      hint: (
        <>
          de <b>{mail.limit}</b> por dia
        </>
      ),
      icon: SendIcon,
      tone: "blue",
      to: "/conversas",
    },
    {
      label: "Responderam",
      value: stats.replied,
      hint:
        rate === null ? (
          "nenhum envio ainda"
        ) : (
          <>
            <b>{rate}%</b> dos contatados
          </>
        ),
      icon: ReplyIcon,
      tone: "green",
      to: "/leads",
      search: { view: "talking" },
    },
    {
      label: "IA conversando",
      value: stats.aiTalking,
      hint: "responde em minutos",
      icon: SparklesIcon,
      tone: "purple",
      to: "/conversas",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {items.map((item, index) => (
        <Lift
          key={item.label}
          role="link"
          tabIndex={0}
          aria-label={`${item.label}: ${item.value}`}
          onClick={() => void navigate({ to: item.to, search: item.search })}
          onKeyDown={(event) => {
            if (event.key === "Enter") void navigate({ to: item.to, search: item.search });
          }}
          className="grouped enter grid content-start gap-2 rounded-[18px]! px-3 pt-3 pb-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:gap-3 sm:px-4 sm:pt-3.5 sm:pb-4"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <span className="flex items-center gap-2 text-[12.5px] font-medium text-muted-foreground sm:text-sm">
            <IconTile icon={item.icon} tone={item.tone} className="max-sm:hidden" />
            {item.label}
          </span>
          <span className="text-2xl leading-none font-medium tracking-[-0.04em] tabular-nums sm:text-3xl">
            {item.value}
          </span>
          <span className="text-[12.5px] font-light text-muted-foreground max-sm:hidden [&_b]:font-medium [&_b]:text-foreground">
            {item.hint}
          </span>
          <span
            aria-hidden
            className="lift-go absolute right-3.5 bottom-3.5 grid size-[22px] place-items-center rounded-full bg-fill text-muted-foreground max-sm:hidden"
          >
            <ArrowRightIcon className="size-3" strokeWidth={2.4} />
          </span>
        </Lift>
      ))}
    </div>
  );
}

function Funnel({ data }: { data: Dashboard }) {
  const { stats } = data;
  const steps = [
    { label: "Na base", value: stats.leads },
    { label: "Com e-mail", value: stats.withEmail },
    { label: "Contatados", value: stats.contacted },
    { label: "Responderam", value: stats.replied },
    { label: "Interessados", value: stats.interested },
    { label: "Fechados", value: stats.closed },
  ];
  const max = Math.max(1, stats.leads);
  return (
    <section className="enter min-w-0">
      <SectionHeader
        title="Funil"
        hint={
          stats.readyToSend > 0
            ? `${stats.readyToSend} ${stats.readyToSend === 1 ? "lead pronto" : "leads prontos"} para disparo.`
            : "Nenhum lead novo com e-mail esperando disparo."
        }
      />
      <div className="grouped py-2">
        {steps.map((step, index) => {
          const previous = index > 0 ? steps[index - 1]?.value : undefined;
          const percent =
            previous !== undefined && previous > 0
              ? Math.round((step.value / previous) * 100)
              : null;
          return (
            <div
              key={step.label}
              className="grid grid-cols-[96px_minmax(0,1fr)_52px] items-center gap-3 px-4 py-2.5 sm:grid-cols-[130px_minmax(0,1fr)_64px] sm:gap-3.5"
            >
              <span className="truncate text-muted-foreground">{step.label}</span>
              <span className="h-2 overflow-hidden rounded-full bg-fill-2">
                <span
                  className="bar-grow block h-full min-w-2 rounded-full bg-green"
                  style={{
                    width: `${Math.max(1.5, (step.value / max) * 100)}%`,
                    opacity: 1 - index * 0.1,
                    animationDelay: `${index * 60}ms`,
                  }}
                />
              </span>
              <span className="text-right font-medium tabular-nums">
                {step.value}
                {percent !== null ? (
                  <span className="block text-[11px] font-normal text-tertiary">{percent}%</span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Activity({ data }: { data: Dashboard }) {
  const events = [
    ...data.activity.searches.map((search) => ({
      at: search.createdAt,
      tone: (search.origin === "autopilot" ? "purple" : "blue") as Tone,
      icon: search.origin === "autopilot" ? BotIcon : SearchIcon,
      title: `${search.niche} em ${search.city}`,
      verb: `${search.origin === "autopilot" ? "Busca automática" : "Busca"}, ${search.foundCount} ${search.foundCount === 1 ? "empresa nova" : "empresas novas"}`,
    })),
    ...data.activity.emails.map((email) => {
      const kind =
        email.direction === "in"
          ? ({ tone: "green", icon: ReplyIcon, verb: "respondeu" } as const)
          : email.author === "ai"
            ? email.inReplyTo
              ? ({ tone: "purple", icon: SparklesIcon, verb: "a IA respondeu" } as const)
              : ({ tone: "blue", icon: SendIcon, verb: "e-mail enviado" } as const)
            : ({ tone: "gray", icon: UserIcon, verb: "você respondeu" } as const);
      return { at: email.at ?? new Date(0), title: email.name, ...kind };
    }),
  ]
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array built above
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  return (
    <section className="enter">
      <SectionHeader title="Atividade de hoje" />
      <div className="grouped">
        {events.length === 0 ? (
          <p className="px-4 py-5 text-sm font-light text-muted-foreground">Nada ainda hoje.</p>
        ) : (
          events.map((event) => (
            <GroupedRow
              key={`${event.at.getTime()}${event.title}${event.verb}`}
              lead={<IconTile icon={event.icon} tone={event.tone} size={30} />}
              title={event.title}
              subtitle={event.verb}
              trailing={
                <span className="text-[12.5px] text-tertiary tabular-nums">
                  {shortTime(event.at, data.today)}
                </span>
              }
            />
          ))
        )}
      </div>
    </section>
  );
}

function Automation({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: (changes: { autopilot?: boolean; aiAutoReply?: boolean; autoDispatch?: boolean }) =>
      setAutomation({ data: changes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    onError: errorToast("Não foi possível mudar a automação"),
  });

  const { mail, autopilot } = data;
  const rows = [
    {
      key: "aiAutoReply" as const,
      label: "IA responde sozinha",
      hint: "Conversa até a pessoa demonstrar interesse, pedir preço ou reunião.",
      checked: mail.aiAutoReply,
      icon: SparklesIcon,
      tone: "purple" as Tone,
    },
    {
      key: "autoDispatch" as const,
      label: "Disparo automático",
      hint: "Leads novos com e-mail entram na fila sem você selecionar.",
      checked: mail.autoDispatch,
      icon: SendIcon,
      tone: "blue" as Tone,
    },
    {
      key: "autopilot" as const,
      label: "Busca diária",
      hint:
        autopilot.targets.length > 0
          ? `Às ${autopilot.hour}h: ${autopilot.targets.map((t) => `${t.niche} em ${t.city}`).join(", ")}`
          : "Cadastre um nicho e uma cidade em Ajustar.",
      checked: autopilot.enabled,
      icon: ClockIcon,
      tone: "green" as Tone,
    },
  ];

  return (
    <section className="enter min-w-0">
      <SectionHeader
        title="Modo automático"
        action={
          <Link
            to="/settings"
            hash="piloto"
            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-blue hover:underline"
          >
            <Settings2Icon className="size-3.5" />
            Ajustar
          </Link>
        }
      />
      <div className="grouped">
        {rows.map((row) => (
          <GroupedRow
            key={row.key}
            lead={<IconTile icon={row.icon} tone={row.tone} size={30} />}
            title={<label htmlFor={row.key}>{row.label}</label>}
            subtitle={row.hint}
            trailing={
              <Switch
                id={row.key}
                checked={row.checked}
                style={{ "--switch-on": toneVar(row.tone) }}
                disabled={
                  toggle.isPending || (row.key === "autopilot" && autopilot.targets.length === 0)
                }
                onCheckedChange={(value) => toggle.mutate({ [row.key]: value })}
              />
            }
          />
        ))}
      </div>
      <div className="grouped mt-3">
        <PropertyRow label="Fila de envio">
          {mail.queued > 0
            ? `${mail.queued} · próximo ${mail.nextSendAt ? shortTime(mail.nextSendAt, data.today) : "agora"}`
            : "vazia"}
        </PropertyRow>
        <PropertyRow label="IA no mês">
          US$ {data.costs.month.aiCostUsd.toFixed(2).replace(".", ",")}
        </PropertyRow>
        <PropertyRow label="Google no mês">
          {data.costs.month.placesRequests}{" "}
          <span className="font-light text-muted-foreground">de 1.000 grátis</span>
        </PropertyRow>
      </div>
    </section>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Page, useOpenNewSearch } from "@/components/app-shell";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { shortTime } from "@/lib/format";
import { dashboardQuery } from "@/lib/queries";
import { runAutopilotNow, setAutomation, type Dashboard } from "@/server/dashboard";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: OverviewPage,
});

function OverviewPage() {
  const { data } = useQuery(dashboardQuery);
  const openNewSearch = useOpenNewSearch();
  const actions = (
    <>
      <Button variant="outline" size="sm" onClick={openNewSearch}>
        Buscar empresas
      </Button>
      <Button asChild size="sm">
        <Link to="/leads" search={{ view: "todo" }}>
          Selecionar e disparar
        </Link>
      </Button>
    </>
  );

  if (!data) {
    return (
      <Page title="Visão geral" actions={actions}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </Page>
    );
  }

  return (
    <Page title="Visão geral" actions={actions}>
      <SetupAlerts data={data} />
      <Attention data={data} />
      <Stats data={data} />
      <Funnel data={data} />
      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <Activity data={data} />
        <Automation data={data} />
      </div>
    </Page>
  );
}

function SetupAlerts({ data }: { data: Dashboard }) {
  return (
    <>
      {!data.mail.configured ? (
        <Alert>
          <AlertTitle>Conecte a sua caixa de e-mail</AlertTitle>
          <AlertDescription>
            O disparo e as respostas da IA saem dela. Coloque MAIL_ADDRESS e MAIL_PASSWORD no
            .dev.vars e teste a conexão nas Configurações.
          </AlertDescription>
          <AlertAction>
            <Button asChild size="sm" variant="outline">
              <Link to="/settings" hash="email">
                Configurar
              </Link>
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {!data.setup.offer ? (
        <Alert>
          <AlertTitle>Falta dizer o que você vende</AlertTitle>
          <AlertDescription>
            Sem isso a IA não escreve e-mails, porque não teria o que oferecer.
          </AlertDescription>
          <AlertAction>
            <Button asChild size="sm" variant="outline">
              <Link to="/settings">Descrever</Link>
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
    </>
  );
}

function Attention({ data }: { data: Dashboard }) {
  if (data.attention.length === 0) return null;
  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle>Precisa de você</CardTitle>
        <CardDescription>A IA parou nestas conversas e passou para você responder.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {data.attention.map((lead) => (
          <div
            key={lead.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{lead.name}</p>
              <p className="text-sm text-muted-foreground">
                {lead.handoffReason ?? "Respondeu"}
                {lead.lastEmailAt ? ` · ${shortTime(lead.lastEmailAt)}` : ""}
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/conversas" search={{ lead: lead.id }}>
                Abrir conversa
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Stats({ data }: { data: Dashboard }) {
  const { stats, mail } = data;
  const rate = stats.contacted > 0 ? Math.round((stats.replied / stats.contacted) * 100) : null;
  const items = [
    { label: "E-mails hoje", value: `${mail.sentToday}`, hint: `de ${mail.limit} por dia` },
    {
      label: "Responderam",
      value: `${stats.replied}`,
      hint: rate === null ? "nenhum envio ainda" : `${rate}% dos contatados`,
    },
    { label: "IA conversando", value: `${stats.aiTalking}`, hint: "responde em minutos" },
    { label: "Interessados", value: `${stats.interested}`, hint: "esperando você" },
    { label: "Descadastros", value: `${stats.unsubscribed}`, hint: "nunca recebem de novo" },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label} className="gap-2">
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">{item.value}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{item.hint}</CardContent>
        </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>Funil</CardTitle>
        <CardDescription>
          {stats.readyToSend > 0
            ? `${stats.readyToSend} ${stats.readyToSend === 1 ? "lead pronto" : "leads prontos"} para disparo.`
            : "Nenhum lead novo com e-mail esperando disparo."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        {steps.map((step) => (
          <div key={step.label} className="grid content-end gap-2">
            <div className="flex h-20 items-end rounded-md bg-muted">
              <div
                className="w-full rounded-md bg-primary/80"
                style={{ height: `${Math.max(3, (step.value / max) * 100)}%` }}
              />
            </div>
            <div>
              <p className="text-lg font-semibold tabular-nums">{step.value}</p>
              <p className="text-xs text-muted-foreground">{step.label}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Activity({ data }: { data: Dashboard }) {
  const events = [
    ...data.activity.searches.map((search) => ({
      at: search.createdAt,
      text: `${search.origin === "autopilot" ? "Busca automática" : "Busca"}: ${search.niche} em ${search.city}, ${search.foundCount} ${search.foundCount === 1 ? "empresa nova" : "empresas novas"}`,
    })),
    ...data.activity.emails.map((email) => ({
      at: email.at ?? new Date(0),
      text:
        email.direction === "in"
          ? `${email.name} respondeu`
          : email.author === "ai"
            ? email.inReplyTo
              ? `A IA respondeu ${email.name}`
              : `E-mail enviado para ${email.name}`
            : `Você respondeu ${email.name}`,
    })),
  ]
    // oxlint-disable-next-line unicorn/no-array-sort -- sorts the fresh array built above
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Atividade de hoje</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada ainda hoje.</p>
        ) : (
          <ol className="grid gap-3 text-sm">
            {events.map((event) => (
              <li key={`${event.at.getTime()}${event.text}`} className="flex gap-4">
                <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
                  {shortTime(event.at, data.today)}
                </span>
                <span>{event.text}</span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function Automation({ data }: { data: Dashboard }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  const toggle = useMutation({
    mutationFn: (changes: { autopilot?: boolean; aiAutoReply?: boolean; autoDispatch?: boolean }) =>
      setAutomation({ data: changes }),
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível mudar a automação"),
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
    onError: (error) => toast.error(error.message || "Não foi possível buscar agora"),
  });

  const { mail, autopilot } = data;
  const rows = [
    {
      key: "aiAutoReply" as const,
      label: "IA responde sozinha",
      hint: "Conversa até a pessoa demonstrar interesse, pedir preço ou reunião.",
      checked: mail.aiAutoReply,
    },
    {
      key: "autoDispatch" as const,
      label: "Disparo automático",
      hint: "Leads novos com e-mail entram na fila sem você selecionar.",
      checked: mail.autoDispatch,
    },
    {
      key: "autopilot" as const,
      label: "Busca diária",
      hint:
        autopilot.targets.length > 0
          ? `Às ${autopilot.hour}h: ${autopilot.targets.map((t) => `${t.niche} em ${t.city}`).join(", ")}`
          : "Nenhum nicho cadastrado.",
      checked: autopilot.enabled,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Modo automático</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {rows.map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-4">
            <div className="grid gap-0.5">
              <Label htmlFor={row.key}>{row.label}</Label>
              <p className="text-xs text-muted-foreground">{row.hint}</p>
            </div>
            <Switch
              id={row.key}
              checked={row.checked}
              disabled={
                toggle.isPending || (row.key === "autopilot" && autopilot.targets.length === 0)
              }
              onCheckedChange={(value) => toggle.mutate({ [row.key]: value })}
            />
          </div>
        ))}
        <Separator />
        <dl className="grid gap-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Fila de envio</dt>
            <dd>
              {mail.queued > 0
                ? `${mail.queued} · próximo ${mail.nextSendAt ? shortTime(mail.nextSendAt, data.today) : "agora"}`
                : "vazia"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">IA no mês</dt>
            <dd>US$ {data.costs.month.aiCostUsd.toFixed(2).replace(".", ",")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Google no mês</dt>
            <dd>{data.costs.month.placesRequests} de 1.000 grátis</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="gap-2">
        {autopilot.targets.length > 0 ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending || !data.setup.keys}
          >
            {runNow.isPending ? "Buscando…" : "Buscar agora"}
          </Button>
        ) : null}
        <Button asChild size="sm" variant="ghost">
          <Link to="/settings" hash="piloto">
            Ajustar
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

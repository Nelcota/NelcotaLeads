import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Page, useOpenNewSearch } from "@/components/app-shell";
import { ScoreBadge } from "@/components/lead-badges";
import { LeadSheet } from "@/components/lead-sheet";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatIsoLocal, relativeDay } from "@/lib/format";
import { dashboardQuery } from "@/lib/queries";
import type { LeadView } from "@/lib/schemas";
import {
  runAutopilotNow,
  setAutopilotEnabled,
  writeMissingMessages,
  type Dashboard,
} from "@/server/dashboard";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: DashboardPage,
});

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
  const openNewSearch = useOpenNewSearch();
  const [openId, setOpenId] = useState<string>();

  const actions = (
    <Button variant="outline" size="sm" onClick={openNewSearch}>
      Busca manual
    </Button>
  );
  if (!data) {
    return (
      <Page title="Painel" actions={actions}>
        <DashboardSkeleton />
      </Page>
    );
  }

  const readyIds = data.ready.map((lead) => lead.id);
  const followUpIds = data.followUps.map((lead) => lead.id);
  const inReady = openId !== undefined && readyIds.includes(openId);

  return (
    <Page title="Painel" actions={actions}>
      {!data.setup.offer ? (
        <Alert>
          <AlertTitle>Falta dizer o que você vende</AlertTitle>
          <AlertDescription>
            Sem isso a IA não escreve mensagens, porque não teria o que oferecer, e a nota fica
            genérica.
          </AlertDescription>
          <AlertAction>
            <Button asChild size="sm">
              <Link to="/settings">Descrever</Link>
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      <AutopilotCard data={data} />
      <Stats data={data} />

      <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="grid min-w-0 content-start gap-4 lg:col-span-2 lg:gap-6">
          <ReadyCard data={data} onOpen={setOpenId} />
          <FollowUpsCard data={data} onOpen={setOpenId} />
        </div>
        <div className="grid min-w-0 content-start gap-4 lg:gap-6">
          <ActivityCard data={data} />
          <FunnelCard data={data} />
        </div>
      </div>

      <LeadSheet
        leadId={openId}
        ids={inReady ? readyIds : followUpIds}
        onSelect={setOpenId}
        keepsLead={(status) =>
          inReady ? status === "new" : status === "contacted" || status === "replied"
        }
      />
    </Page>
  );
}

function AutopilotCard({ data }: { data: Dashboard }) {
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
  const ranToday = autopilot.lastRunOn === data.today;
  const hasTargets = autopilot.targets.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Piloto automático</CardTitle>
        <CardDescription>
          {!hasTargets
            ? "Diga o que buscar e a IA traz leads novos todo dia, já com nota e mensagem."
            : !enabled
              ? "Desligado. Ligue para buscar todo dia automaticamente."
              : ranToday
                ? `Buscou hoje. Próxima busca amanhã às ${autopilot.hour}h.`
                : `Próxima busca hoje às ${autopilot.hour}h.`}
        </CardDescription>
        <CardAction>
          <Switch
            checked={enabled}
            disabled={toggle.isPending || !hasTargets}
            onCheckedChange={(value) => toggle.mutate(value)}
            aria-label="Piloto automático"
          />
        </CardAction>
      </CardHeader>
      {hasTargets ? (
        <CardContent className="flex flex-wrap gap-2">
          {autopilot.targets.map((target) => (
            <Badge key={`${target.niche}-${target.city}`} variant="secondary">
              {target.niche} em {target.city}
            </Badge>
          ))}
        </CardContent>
      ) : null}
      <CardFooter className="gap-2">
        {hasTargets ? (
          <Button
            size="sm"
            onClick={() => runNow.mutate()}
            disabled={runNow.isPending || !data.setup.keys}
          >
            {runNow.isPending ? "Buscando…" : "Buscar agora"}
          </Button>
        ) : null}
        <Button asChild size="sm" variant={hasTargets ? "outline" : "default"}>
          <Link to="/settings" hash="piloto">
            {hasTargets ? "Ajustar" : "Configurar"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function Stats({ data }: { data: Dashboard }) {
  const reminders = data.activity.reminders;
  const items = [
    {
      label: "Prontos para enviar",
      value: String(data.ready.length),
      footer:
        data.analyzing > 0
          ? `Analisando ${data.analyzing} ${data.analyzing === 1 ? "empresa" : "empresas"}`
          : "Mensagens escritas pela IA",
    },
    {
      label: "Retornos de hoje",
      value: String(data.followUps.length),
      footer: `${reminders} ${reminders === 1 ? "lembrete pronto" : "lembretes prontos"}`,
    },
    {
      label: "Aguardando resposta",
      value: String(data.funnel.waiting),
      footer: `${data.funnel.talking} em conversa`,
    },
    {
      label: "Custo do mês",
      value: `US$ ${data.costs.month.aiCostUsd.toFixed(2).replace(".", ",")}`,
      footer: `Google: ${data.costs.month.placesRequests} de 1.000 requisições grátis`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums">{item.value}</CardTitle>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">{item.footer}</CardFooter>
        </Card>
      ))}
    </div>
  );
}

function ReadyCard({ data, onOpen }: { data: Dashboard; onOpen: (id: string) => void }) {
  const refresh = useRefresh();
  const writeMissing = useMutation({
    mutationFn: () => writeMissingMessages(),
    onSuccess: async (result) => {
      await refresh();
      if (result.failed > 0) toast.error(`${result.failed} não puderam ser escritas agora.`);
    },
    onError: (error) => toast.error(error.message || "Não foi possível escrever as mensagens"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pronto para enviar</CardTitle>
        <CardDescription>
          Revise e envie pelo WhatsApp. Ao enviar, o lead passa para Aguardando resposta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.ready.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {!data.setup.offer
              ? "As mensagens aparecem aqui depois que você descrever o que vende."
              : data.analyzing > 0
                ? "A IA está lendo os sites e escrevendo as mensagens."
                : "Nada pendente. Novos leads chegam com o piloto automático ou com uma busca manual."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="hidden md:table-cell">Mensagem</TableHead>
                  <TableHead className="w-16">Nota</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.ready.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => onOpen(lead.id)}
                  >
                    <TableCell className="max-w-56">
                      <p className="truncate font-medium">{lead.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {lead.signals?.[0] ?? lead.phone ?? "Sem telefone"}
                      </p>
                    </TableCell>
                    <TableCell className="hidden max-w-80 md:table-cell">
                      <p className="truncate text-muted-foreground">{lead.firstMessage}</p>
                    </TableCell>
                    <TableCell>
                      <ScoreBadge score={lead.score} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline">
                        Revisar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {data.withoutMessage > 0 && data.setup.offer ? (
        <CardFooter className="flex-wrap gap-3 text-sm text-muted-foreground">
          {data.withoutMessage} {data.withoutMessage === 1 ? "lead novo está" : "leads novos estão"}{" "}
          sem mensagem.
          <Button
            size="sm"
            variant="outline"
            onClick={() => writeMissing.mutate()}
            disabled={writeMissing.isPending}
          >
            {writeMissing.isPending ? "Escrevendo…" : "Escrever agora"}
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function FollowUpsCard({ data, onOpen }: { data: Dashboard; onOpen: (id: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Retornos de hoje</CardTitle>
        <CardDescription>Quem não respondeu ou tem conversa marcada para hoje.</CardDescription>
      </CardHeader>
      <CardContent>
        {data.followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum retorno para hoje.</p>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.followUps.map((lead) => {
                  const ready = lead.followUpMessage && lead.followUpMessageFor === lead.followUpOn;
                  return (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      onClick={() => onOpen(lead.id)}
                    >
                      <TableCell className="max-w-56">
                        <p className="truncate font-medium">{lead.name}</p>
                        {lead.followUpOn && lead.followUpOn < data.today ? (
                          <p className="text-xs text-muted-foreground">
                            Era {relativeDay(lead.followUpOn, data.today)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {lead.status === "replied" ? (
                          <Badge variant="outline">Em conversa</Badge>
                        ) : ready ? (
                          <Badge variant="secondary">Lembrete pronto</Badge>
                        ) : (
                          <Badge variant="outline">Sem resposta</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline">
                          Abrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
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
        `Deu nota para ${activity.analyzed} ${activity.analyzed === 1 ? "empresa" : "empresas"}`,
      activity.messages > 0 &&
        `Escreveu ${activity.messages} ${activity.messages === 1 ? "mensagem" : "mensagens"}`,
      activity.discarded > 0 &&
        `Descartou ${activity.discarded} com nota abaixo de ${setup.minScore}`,
      activity.reminders > 0 &&
        `Preparou ${activity.reminders} ${activity.reminders === 1 ? "lembrete" : "lembretes"}`,
    ]
      .filter((text): text is string => Boolean(text))
      .map((text) => ({ text })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoje</CardTitle>
        <CardDescription>O que a IA fez</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

function FunnelCard({ data }: { data: Dashboard }) {
  const rows: { label: string; value: number; view: LeadView }[] = [
    { label: "Prontos para enviar", value: data.funnel.ready, view: "todo" },
    { label: "Aguardando resposta", value: data.funnel.waiting, view: "waiting" },
    { label: "Em conversa", value: data.funnel.talking, view: "talking" },
    { label: "Fechados", value: data.funnel.closed, view: "closed" },
    { label: "Descartados pela IA", value: data.funnel.aiDiscarded, view: "discarded" },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid">
          {rows.map((row) => (
            <li key={row.label}>
              <Link
                to="/leads"
                search={{ view: row.view }}
                className="-mx-2 flex justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <span>{row.label}</span>
                <span className="font-medium tabular-nums">{row.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </>
  );
}

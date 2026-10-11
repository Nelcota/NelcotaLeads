import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeftIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Page } from "@/components/app-shell";
import { ScoreBadge } from "@/components/lead-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Email } from "@/db/schema";
import { shortTime } from "@/lib/format";
import { conversationQuery, conversationsQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  checkMailNow,
  closeConversation,
  sendReply,
  setConversationAi,
  type ConversationState,
} from "@/server/mail";

const FILTERS = ["all", "needsYou", "aiTalking", "waiting", "closed"] as const;
type Filter = (typeof FILTERS)[number];

const FILTER_LABELS: Record<Filter, string> = {
  all: "Todas",
  needsYou: "Precisa de você",
  aiTalking: "IA conversando",
  waiting: "Sem resposta",
  closed: "Encerradas",
};

const STATE_BADGE: Record<
  ConversationState,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  needsYou: { label: "Precisa de você", variant: "default" },
  aiTalking: { label: "IA conversando", variant: "secondary" },
  waiting: { label: "Sem resposta", variant: "outline" },
  closed: { label: "Encerrada", variant: "outline" },
};

export const Route = createFileRoute("/conversas")({
  validateSearch: z.object({
    lead: z.string().max(64).optional(),
    filter: z.enum(FILTERS).optional(),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(conversationsQuery),
  component: ConversationsPage,
});

function useRefresh() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
    ]);
}

function ConversationsPage() {
  const { lead: openId, filter = "all" } = Route.useSearch();
  const navigate = useNavigate({ from: "/conversas" });
  const { data } = useQuery(conversationsQuery);
  const refresh = useRefresh();
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
    onError: (error) => toast.error(error.message || "Não foi possível verificar os e-mails"),
  });

  const countOf = (item: Filter) =>
    item === "all" ? (data?.length ?? 0) : (data?.filter((row) => row.state === item).length ?? 0);
  const rows = (data ?? []).filter((row) => filter === "all" || row.state === filter);
  const select = (lead: string | undefined) =>
    void navigate({ search: (prev) => ({ ...prev, lead }) });

  return (
    <Page
      title="Conversas"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => check.mutate()}
          disabled={check.isPending}
        >
          {check.isPending ? "Verificando…" : "Verificar e-mails"}
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[340px_minmax(0,1fr)_280px]">
        <Card className={cn("gap-0 py-0", openId && "max-lg:hidden")}>
          <div className="border-b p-3">
            <Tabs
              value={filter}
              onValueChange={(value) => {
                const next = FILTERS.find((item) => item === value);
                if (next) void navigate({ search: (prev) => ({ ...prev, filter: next }) });
              }}
            >
              <div className="no-scrollbar overflow-x-auto">
                <TabsList>
                  {FILTERS.map((item) => (
                    <TabsTrigger key={item} value={item} className="gap-1.5">
                      {FILTER_LABELS[item]}
                      <span className="text-muted-foreground tabular-nums">{countOf(item)}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          </div>
          {data === undefined ? (
            <div className="grid gap-2 p-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {data.length === 0
                ? "Nenhuma conversa ainda. Elas começam quando você dispara e-mails em Leads."
                : "Nada neste filtro."}
            </p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => select(row.id)}
                    aria-current={row.id === openId || undefined}
                    className={cn(
                      "grid w-full gap-1 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      row.id === openId && "bg-muted shadow-[inset_3px_0_0_var(--primary)]",
                    )}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-medium">{row.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {row.lastEmailAt ? shortTime(row.lastEmailAt) : ""}
                      </span>
                    </span>
                    <span className="truncate text-sm text-muted-foreground">{row.preview}</span>
                    <Badge variant={STATE_BADGE[row.state].variant} className="justify-self-start">
                      {STATE_BADGE[row.state].label}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {openId ? (
          <Thread key={openId} leadId={openId} onBack={() => select(undefined)} />
        ) : (
          <Card className="hidden items-center justify-center lg:flex">
            <p className="text-sm text-muted-foreground">Escolha uma conversa.</p>
          </Card>
        )}
      </div>
    </Page>
  );
}

function Thread({ leadId, onBack }: { leadId: string; onBack: () => void }) {
  const { data } = useQuery(conversationQuery(leadId));
  const refresh = useRefresh();
  const [text, setText] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: (body: string) => sendReply({ data: { leadId, body } }),
    onSuccess: async () => {
      setText(null);
      await refresh();
      toast.success("Enviado");
    },
    onError: (error) => toast.error(error.message || "Não foi possível enviar"),
  });
  const ai = useMutation({
    mutationFn: (aiMode: boolean) => setConversationAi({ data: { leadId, aiMode } }),
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível mudar a IA desta conversa"),
  });
  const close = useMutation({
    mutationFn: (outcome: "closed" | "discarded") =>
      closeConversation({ data: { leadId, outcome } }),
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível encerrar"),
  });

  if (!data) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }
  const { lead, state, messages, draft, summary } = data;
  const value = text ?? draft?.body ?? "";
  const closed = state === "closed";

  return (
    <>
      <Card className="min-w-0 gap-0 py-0">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onBack}
            aria-label="Voltar"
          >
            <ChevronLeftIcon />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-semibold">{lead.name}</h2>
            <p className="truncate text-sm text-muted-foreground">{lead.email ?? "sem e-mail"}</p>
          </div>
          {!closed ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="ai-mode" className="text-sm text-muted-foreground">
                IA no comando
              </Label>
              <Switch
                id="ai-mode"
                checked={ai.isPending ? ai.variables : lead.aiMode}
                disabled={ai.isPending}
                onCheckedChange={(checked) => ai.mutate(checked)}
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 p-4 sm:p-6">
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
          {state === "needsYou" && lead.handoffReason ? (
            <Alert>
              <AlertTitle>A IA parou: {lead.handoffReason}</AlertTitle>
              <AlertDescription>
                A conversa é sua. Responda abaixo ou devolva para a IA.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        {!closed && lead.email ? (
          <div className="grid gap-3 border-t p-4 sm:p-6">
            {draft && text === null ? (
              <p className="text-xs text-muted-foreground">Rascunho da IA para você revisar</p>
            ) : null}
            <Textarea
              aria-label="Sua resposta"
              rows={5}
              placeholder="Escreva sua resposta. A assinatura é adicionada no envio."
              value={value}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={!value.trim() || send.isPending} onClick={() => send.mutate(value)}>
                {send.isPending ? "Enviando…" : "Enviar"}
              </Button>
              {state === "needsYou" ? (
                <Button variant="outline" disabled={ai.isPending} onClick={() => ai.mutate(true)}>
                  Devolver para a IA
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="h-fit xl:sticky xl:top-20">
        <CardHeader>
          <CardTitle>Detalhes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATE_BADGE[state].variant}>{STATE_BADGE[state].label}</Badge>
            <ScoreBadge score={lead.score} />
          </div>
          <dl className="grid gap-2">
            <Term label="Telefone">{lead.phone ?? "sem telefone"}</Term>
            <Term label="Site">
              {lead.website ? (
                <a
                  href={lead.website}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all underline-offset-4 hover:underline"
                >
                  {lead.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </a>
              ) : (
                "sem site"
              )}
            </Term>
            {lead.rating !== null ? (
              <Term label="Google">
                {lead.rating.toFixed(1).replace(".", ",")} ({lead.reviewCount ?? 0} avaliações)
              </Term>
            ) : null}
          </dl>
          {summary ? (
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Resumo da IA</p>
              <p className="leading-relaxed">{summary}</p>
            </div>
          ) : null}
          <Link
            to="/leads"
            search={{ view: "all", lead: lead.id }}
            className="text-sm underline-offset-4 hover:underline"
          >
            Ver análise completa
          </Link>
          {!closed ? (
            <div className="grid gap-2">
              <Button
                variant="outline"
                disabled={close.isPending}
                onClick={() => close.mutate("closed")}
              >
                Marcar como fechado
              </Button>
              <Button
                variant="ghost"
                disabled={close.isPending}
                onClick={() => close.mutate("discarded")}
              >
                Encerrar sem negócio
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}

function Message({ message }: { message: Email }) {
  const out = message.direction === "out";
  const who = out ? (message.author === "ai" ? "IA, em seu nome" : "Você") : "Empresa";
  const when =
    message.status === "queued"
      ? message.sendAfter
        ? `na fila, sai ${shortTime(message.sendAfter)}`
        : "na fila"
      : message.status === "failed"
        ? `não enviado: ${message.error ?? "erro"}`
        : message.sentAt
          ? shortTime(message.sentAt)
          : "";
  return (
    <article
      className={cn(
        "grid max-w-[85%] gap-1.5 rounded-xl px-4 py-3 text-sm",
        out ? "justify-self-end border bg-background" : "justify-self-start bg-muted",
        message.status === "failed" && "border-destructive/40",
      )}
    >
      <p className="text-xs text-muted-foreground">
        {who} · {when}
      </p>
      {message.inReplyTo === null && out ? <p className="font-medium">{message.subject}</p> : null}
      <p className="leading-relaxed whitespace-pre-line">{message.body}</p>
    </article>
  );
}

function Term({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

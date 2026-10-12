import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  GlobeIcon,
  HandIcon,
  MessagesSquareIcon,
  PhoneIcon,
  RefreshCwIcon,
  SendIcon,
  SparklesIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Avatar,
  EmptyState,
  IconTile,
  PropertyRow,
  TONE_TEXT,
  type Tone,
} from "@/components/apple-ui";
import { Page } from "@/components/app-shell";
import { ScoreBadge } from "@/components/lead-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Email } from "@/db/schema";
import { shortTime } from "@/lib/format";
import { conversationQuery, conversationsQuery } from "@/lib/queries";
import { cn, safeHttpUrl } from "@/lib/utils";
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

const STATE_BADGE: Record<ConversationState, { label: string; tone: Tone }> = {
  needsYou: { label: "Precisa de você", tone: "orange" },
  aiTalking: { label: "IA conversando", tone: "purple" },
  waiting: { label: "Sem resposta", tone: "gray" },
  closed: { label: "Encerrada", tone: "gray" },
};

const FILTER_TONE: Partial<Record<Filter, Tone>> = { needsYou: "orange", aiTalking: "purple" };

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

function StateBadge({ state }: { state: ConversationState }) {
  const badge = STATE_BADGE[state];
  return (
    <Badge
      variant={badge.tone}
      dot={state === "needsYou"}
      className={cn(state === "closed" && "opacity-70")}
    >
      {state === "aiTalking" ? <SparklesIcon /> : null}
      {badge.label}
    </Badge>
  );
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
      bleed
      actions={
        <Button
          variant="outline"
          size="icon"
          onClick={() => check.mutate()}
          disabled={check.isPending}
          aria-label={check.isPending ? "Verificando…" : "Verificar e-mails"}
          title={check.isPending ? "Verificando…" : "Verificar e-mails"}
        >
          <RefreshCwIcon className={cn(check.isPending && "animate-spin")} />
        </Button>
      }
    >
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] border-t border-border/70 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)_290px]">
        <div
          className={cn(
            "flex min-h-0 flex-col border-border/70 lg:border-r",
            openId && "max-lg:hidden",
          )}
        >
          <div className="px-3.5 pt-3 pb-2">
            <Tabs
              value={filter}
              onValueChange={(value) => {
                const next = FILTERS.find((item) => item === value);
                if (next) void navigate({ search: (prev) => ({ ...prev, filter: next }) });
              }}
            >
              <div className="no-scrollbar overflow-x-auto">
                <TabsList>
                  {FILTERS.map((item) => {
                    const count = countOf(item);
                    const tone = FILTER_TONE[item];
                    return (
                      <TabsTrigger key={item} value={item} className="gap-1.5 px-2.5">
                        {FILTER_LABELS[item]}
                        <span
                          className={cn(
                            "text-[11.5px] tabular-nums",
                            tone && count > 0 ? TONE_TEXT[tone] : "opacity-60",
                          )}
                        >
                          {count}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
            </Tabs>
          </div>
          {data === undefined ? (
            <div className="grid gap-2 p-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={MessagesSquareIcon}
              tone="orange"
              title={data.length === 0 ? "Nenhuma conversa ainda" : "Nada neste filtro."}
              description={
                data.length === 0 ? "Elas começam quando você dispara e-mails em Leads." : undefined
              }
            />
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {rows.map((row) => {
                const selectedRow = row.id === openId;
                const unread = row.state === "needsYou";
                return (
                  <li key={row.id} className="grouped-row [--inset:28px]">
                    <button
                      type="button"
                      onClick={() => select(row.id)}
                      aria-current={selectedRow || undefined}
                      className={cn(
                        "grid w-full grid-cols-[12px_minmax(0,1fr)] gap-1.5 rounded-xl py-3 pr-3 pl-2 text-left transition-[background-color,transform] duration-300 ease-spring",
                        selectedRow
                          ? "bg-blue/25"
                          : "hover:translate-x-0.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.035]",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 size-[9px] rounded-full bg-orange",
                          !unread && "invisible",
                        )}
                      />
                      <span className="grid min-w-0 gap-1">
                        <span className="flex items-center gap-2.5">
                          <Avatar name={row.name} size={28} />
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate",
                              unread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {row.name}
                          </span>
                          <span className="shrink-0 text-[11.5px] text-tertiary tabular-nums">
                            {row.lastEmailAt ? shortTime(row.lastEmailAt) : ""}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "line-clamp-2 text-sm font-light",
                            selectedRow ? "text-foreground/80" : "text-muted-foreground",
                          )}
                        >
                          {row.preview}
                        </span>
                        <span>
                          <StateBadge state={row.state} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {openId ? (
          <Thread key={openId} leadId={openId} onBack={() => select(undefined)} />
        ) : (
          <div className="hidden items-center justify-center lg:flex">
            <EmptyState icon={MessagesSquareIcon} title="Escolha uma conversa." />
          </div>
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
      <div className="grid content-start gap-3 p-6">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  const { lead, state, messages, draft, summary } = data;
  const value = text ?? draft?.body ?? "";
  const closed = state === "closed";
  const firstOut = messages.find((message) => message.direction === "out" && !message.inReplyTo);

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3 sm:px-7">
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onBack}
            aria-label="Voltar"
          >
            <ChevronLeftIcon />
          </Button>
          <Avatar name={lead.name} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-medium">{lead.name}</h2>
            <p className="truncate text-xs font-light text-muted-foreground">
              {lead.email ?? "sem e-mail"}
            </p>
          </div>
          {!closed ? (
            <label
              htmlFor="ai-mode"
              className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full bg-fill-2 py-1 pr-1 pl-3 text-[12.5px] font-medium whitespace-nowrap text-purple"
            >
              <SparklesIcon className="size-3.5" />
              <span className="max-sm:hidden">IA no comando</span>
              <span className="sm:hidden">IA</span>
              <Switch
                id="ai-mode"
                size="sm"
                checked={ai.isPending ? ai.variables : lead.aiMode}
                disabled={ai.isPending}
                style={{ "--switch-on": "var(--purple)" }}
                onCheckedChange={(checked) => ai.mutate(checked)}
              />
            </label>
          ) : null}
        </div>

        <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto px-5 pb-3 sm:px-7 xl:hidden">
          {!closed ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="text-green"
                disabled={close.isPending}
                onClick={() => close.mutate("closed")}
              >
                <CircleCheckIcon />
                Fechado
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="text-red"
                disabled={close.isPending}
                onClick={() => close.mutate("discarded")}
              >
                <XIcon />
                Sem negócio
              </Button>
            </>
          ) : null}
          {lead.phone ? (
            <Button asChild size="sm" variant="secondary">
              <a href={`tel:${lead.phone}`}>
                <PhoneIcon />
                Ligar
              </a>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="secondary">
            <Link to="/leads" search={{ view: "all", lead: lead.id }}>
              Ver lead
              <ChevronRightIcon />
            </Link>
          </Button>
        </div>

        <div className="scroll-fade min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-7">
          {firstOut ? (
            <h3 className="mt-1 mb-1 max-w-[68ch] text-2xl font-medium tracking-[-0.025em]">
              {firstOut.subject}
            </h3>
          ) : null}
          {messages.map((message) => (
            <Message key={message.id} message={message} leadName={lead.name} />
          ))}
          {state === "needsYou" && lead.handoffReason ? (
            <div className="my-4 flex max-w-[68ch] items-center gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--orange)_11%,transparent)] px-4 py-3 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--orange)_24%,transparent)]">
              <IconTile icon={HandIcon} tone="orange" size={28} />
              <div className="text-sm">
                <p className="font-medium text-orange">A IA parou: {lead.handoffReason}</p>
                <p className="font-light text-muted-foreground">
                  A conversa é sua. Responda abaixo ou devolva para a IA.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {!closed && lead.email ? (
          <div className="px-4 pb-4 sm:px-5">
            <div
              data-glass
              className="rounded-[18px] bg-[rgb(44_44_48/0.6)] shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.06),0_16px_36px_rgb(0_0_0/0.4)] backdrop-blur-[30px] [:root:not(.dark)_&]:bg-white [:root:not(.dark)_&]:shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_rgb(0_0_0/0.08)]"
            >
              <div className="flex min-w-0 items-center gap-2 px-4 pt-3 text-[12.5px] text-muted-foreground">
                Para
                <span className="min-w-0 truncate rounded-full bg-fill-2 px-2.5 py-0.5 text-[11.5px] font-medium text-foreground">
                  {lead.email}
                </span>
                {draft && text === null ? (
                  <Badge variant="purple" className="ml-auto shrink-0">
                    <SparklesIcon />
                    <span className="max-sm:hidden">Rascunho da IA para você revisar</span>
                    <span className="sm:hidden">Rascunho da IA</span>
                  </Badge>
                ) : null}
              </div>
              <Textarea
                aria-label="Sua resposta"
                rows={4}
                placeholder="Escreva sua resposta."
                value={value}
                className="bg-transparent! px-4 text-base leading-[1.7] shadow-none! focus-visible:ring-0"
                onChange={(event) => setText(event.target.value)}
              />
              <div className="flex flex-wrap items-center justify-end gap-2 px-2 pt-1 pb-2 pl-4">
                <span className="mr-auto text-xs font-light text-tertiary max-sm:hidden">
                  A assinatura é adicionada no envio.
                </span>
                {state === "needsYou" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="text-purple"
                    disabled={ai.isPending}
                    onClick={() => ai.mutate(true)}
                  >
                    <SparklesIcon />
                    Devolver para a IA
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  disabled={!value.trim() || send.isPending}
                  onClick={() => send.mutate(value)}
                >
                  <SendIcon />
                  {send.isPending ? "Enviando…" : "Enviar"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <aside className="hidden min-h-0 content-start gap-5 overflow-y-auto border-l border-border/70 px-4 py-5 xl:grid">
        <div className="grid justify-items-center gap-2 text-center">
          <Avatar name={lead.name} size={56} />
          <p className="text-base font-medium">{lead.name}</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            <StateBadge state={state} />
            <ScoreBadge score={lead.score} />
          </div>
          <div className="mt-1 flex gap-2">
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="press" aria-label="Ligar" title="Ligar">
                <IconTile icon={PhoneIcon} tone="green" size={32} round />
              </a>
            ) : null}
            {safeHttpUrl(lead.website) ? (
              <a
                href={safeHttpUrl(lead.website) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="press"
                aria-label="Site"
                title="Site"
              >
                <IconTile icon={GlobeIcon} tone="gray" size={32} round />
              </a>
            ) : null}
          </div>
        </div>
        <div className="grouped">
          <PropertyRow label="Telefone">{lead.phone ?? "sem telefone"}</PropertyRow>
          <PropertyRow label="Site">
            {lead.website && !safeHttpUrl(lead.website) ? (
              <span className="break-all">{lead.website}</span>
            ) : lead.website ? (
              <a
                href={safeHttpUrl(lead.website) ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue hover:underline"
              >
                {lead.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                <ArrowUpRightIcon className="size-3 shrink-0" />
              </a>
            ) : (
              "sem site"
            )}
          </PropertyRow>
          {lead.rating !== null ? (
            <PropertyRow label="Google">
              <span className="inline-flex items-center gap-1">
                <StarIcon className="size-3 fill-yellow text-yellow" />
                {lead.rating.toFixed(1).replace(".", ",")} ({lead.reviewCount ?? 0} avaliações)
              </span>
            </PropertyRow>
          ) : null}
        </div>
        {summary ? (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 px-1.5 text-xs font-medium text-purple">
              <SparklesIcon className="size-3.5" />
              Resumo da IA
            </p>
            <p className="grouped px-4 py-3 text-sm leading-relaxed font-light text-muted-foreground">
              {summary}
            </p>
          </div>
        ) : null}
        <div className="grouped">
          <Link
            to="/leads"
            search={{ view: "all", lead: lead.id }}
            className="grouped-row row-hover flex min-h-[44px] items-center px-4 font-medium text-blue [--inset:16px] hover:bg-fill-3"
          >
            <span className="flex-1">Ver análise completa</span>
            <ChevronRightIcon className="row-chev size-3.5 text-quaternary" />
          </Link>
          {!closed ? (
            <>
              <button
                type="button"
                disabled={close.isPending}
                onClick={() => close.mutate("closed")}
                className="grouped-row flex min-h-[44px] w-full items-center gap-2 px-4 text-left font-medium text-green [--inset:16px] hover:bg-fill-3 disabled:opacity-50"
              >
                <CircleCheckIcon className="size-4" />
                Marcar como fechado
              </button>
              <button
                type="button"
                disabled={close.isPending}
                onClick={() => close.mutate("discarded")}
                className="grouped-row flex min-h-[44px] w-full items-center px-4 text-left font-medium text-red [--inset:16px] hover:bg-fill-3 disabled:opacity-50"
              >
                Encerrar sem negócio
              </button>
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function Message({ message, leadName }: { message: Email; leadName: string }) {
  const out = message.direction === "out";
  const fromAi = out && message.author === "ai";
  const who = out ? (fromAi ? "IA, em seu nome" : "Você") : leadName;
  const when =
    message.status === "queued"
      ? message.sendAfter
        ? `na fila, sai ${shortTime(message.sendAfter)}`
        : "na fila"
      : message.status === "failed"
        ? `não enviado: ${message.error ?? "erro"}`
        : message.status === "cancelled"
          ? (message.error ?? "Cancelado")
          : message.sentAt
            ? shortTime(message.sentAt)
            : "";
  return (
    <article
      className={cn(
        "grid max-w-[68ch] gap-2.5 border-b border-border/70 py-5",
        message.status === "failed" && "border-l-2 border-l-red pl-3",
      )}
    >
      <div className="flex items-center gap-2.5">
        {fromAi ? (
          <IconTile icon={SparklesIcon} tone="purple" size={30} round />
        ) : (
          <Avatar name={out ? "Você" : leadName} size={30} />
        )}
        <span className={cn("font-medium", fromAi && "text-purple")}>{who}</span>
        <span
          className={cn(
            "ml-auto text-xs tabular-nums",
            message.status === "failed"
              ? "text-red"
              : message.status === "queued"
                ? "text-muted-foreground"
                : "text-tertiary",
          )}
        >
          {when}
        </span>
      </div>
      <p
        className={cn(
          "text-base leading-[1.7] whitespace-pre-line",
          message.status === "cancelled" ? "text-muted-foreground" : "text-foreground/85",
        )}
      >
        {message.body}
      </p>
    </article>
  );
}

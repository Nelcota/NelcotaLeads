import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BotIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  GlobeIcon,
  HandIcon,
  InfoIcon,
  MessageCircleIcon,
  MessagesSquareIcon,
  PhoneIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { z } from "zod";
import { lenientSearch } from "@/lib/schemas";
import {
  Avatar,
  EmptyState,
  ExternalLink,
  Hint,
  IconTile,
  PropertyRow,
  TONE_TEXT,
  type Tone,
} from "@/components/apple-ui";
import { Page } from "@/components/app-shell";
import { GLOSSARY } from "@/lib/help";
import { ScoreBadge } from "@/components/lead-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Email } from "@/db/schema";
import { useAutosave } from "@/lib/autosave";
import { failedEmailAction } from "@/lib/email-errors";
import { shortTime } from "@/lib/format";
import { conversationQuery, conversationsQuery, nichesQuery } from "@/lib/queries";
import { useToday } from "@/lib/today";
import { cn, safeHttpUrl } from "@/lib/utils";
import type { CloseSnapshot } from "@/server/conversation";
import { reopenBlocker } from "@/server/lead-status";
import { updateLead } from "@/server/leads";
import {
  cancelQueuedEmail,
  checkMailNow,
  closeConversation,
  draftReplyWithAi,
  editQueuedEmail,
  retryEmail,
  saveReplyDraft,
  sendReply,
  setConversationAi,
  undoCloseConversation,
  type ConversationState,
} from "@/server/mail";
import { pageTitle } from "@/lib/page-title";
import { isSendChord, sendShortcut } from "@/lib/shortcuts";
import { matchesQuery } from "@/lib/text-search";
import { useUrlSearchBox } from "@/hooks/use-url-search-box";
import { whatsappLink } from "@/lib/phone";
import { splitQuoted } from "@/lib/mail/quoted";
import { QuickReplyPicker } from "@/components/quick-reply-picker";
import { useListHotkeys } from "@/hooks/use-list-hotkeys";

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

// From `lg` the list and the thread sit side by side, so Esc has nothing to close.
const SIDE_BY_SIDE = "(min-width: 1024px)";

export const Route = createFileRoute("/conversas")({
  head: () => ({ meta: [{ title: pageTitle("Conversas") }] }),
  validateSearch: lenientSearch(
    z.object({
      lead: z.string().max(64).optional(),
      filter: z.enum(FILTERS).optional(),
      q: z.string().max(100).optional(),
      niche: z.string().max(120).optional(),
    }),
  ),
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
      // The niche funnel counts leads by status.
      queryClient.invalidateQueries({ queryKey: ["niches"] }),
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
  const { lead: openId, filter = "all", q: urlQuery = "", niche } = Route.useSearch();
  const navigate = useNavigate({ from: "/conversas" });
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // The list filters at once; the URL catches up when the typing pauses.
  const searchBox = useUrlSearchBox(urlQuery, (next) => {
    void navigate({ search: (prev) => ({ ...prev, q: next || undefined }), replace: true });
  });
  const query = searchBox.value;
  const clearSearch = searchBox.clear;

  const { data } = useQuery(conversationsQuery);
  const { data: niches } = useQuery(nichesQuery);
  // Only the niches that have a conversation; the list keeps the overview's order.
  const talkedNiches = (niches ?? []).filter((item) =>
    (data ?? []).some((row) => row.niche === item.key),
  );
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
    onError: errorToast("Não foi possível verificar os e-mails"),
  });

  const searched = (data ?? []).filter(
    (row) =>
      (!niche || row.niche === niche) && matchesQuery([row.name, row.email, row.preview], query),
  );
  const countOf = (item: Filter) =>
    item === "all" ? searched.length : searched.filter((row) => row.state === item).length;
  const rows = searched.filter((row) => filter === "all" || row.state === filter);
  const select = (lead: string | undefined) =>
    void navigate({ search: (prev) => ({ ...prev, lead }) });

  // J/K walk the list as filtered; Esc goes back to it where the thread covers it.
  const position = openId ? rows.findIndex((row) => row.id === openId) : -1;
  const nextRow = position < 0 ? rows[0] : rows[position + 1];
  const prevRow = position > 0 ? rows[position - 1] : undefined;
  useListHotkeys(true, {
    onNext: nextRow ? () => select(nextRow.id) : undefined,
    onPrev: prevRow ? () => select(prevRow.id) : undefined,
    onEscape: openId
      ? () => {
          if (!window.matchMedia(SIDE_BY_SIDE).matches) select(undefined);
        }
      : undefined,
  });
  // The row J/K moved to stays in view.
  useEffect(() => {
    if (!openId) return;
    const row = listRef.current?.querySelector(`[data-row="${CSS.escape(openId)}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [openId]);

  return (
    <Page
      title="Conversas"
      bleed
      actions={
        <Hint label="Verificar e-mails">
          <Button
            variant="outline"
            size="icon"
            onClick={() => check.mutate()}
            disabled={check.isPending}
            aria-label={check.isPending ? "Verificando…" : "Verificar e-mails"}
          >
            <RefreshCwIcon className={cn(check.isPending && "animate-spin")} />
          </Button>
        </Hint>
      }
    >
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] border-t border-border/70 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)_290px]">
        <div
          className={cn(
            "flex min-h-0 flex-col border-border/70 lg:border-r",
            openId && "max-lg:hidden",
          )}
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-2 px-3.5 pt-3 pb-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-tertiary" />
              <Input
                ref={searchRef}
                type="search"
                aria-label="Buscar conversa"
                placeholder="Buscar por nome ou e-mail"
                className={cn("h-10 rounded-full pl-8 sm:h-[30px]", query && "pr-9")}
                {...searchBox.inputProps}
                onKeyDown={(event) => {
                  if (event.key !== "Escape" || !query) return;
                  // Only the search: Esc doesn't also close the conversation.
                  event.preventDefault();
                  event.stopPropagation();
                  clearSearch();
                }}
              />
              {query ? (
                <Hint label="Limpar busca">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Limpar busca"
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 sm:right-0.5 sm:size-6"
                    onClick={() => {
                      clearSearch();
                      searchRef.current?.focus();
                    }}
                  >
                    <XIcon />
                  </Button>
                </Hint>
              ) : null}
            </div>
            {talkedNiches.length > 1 || niche ? (
              <Select
                value={niche ?? "all"}
                onValueChange={(value) =>
                  void navigate({
                    search: (prev) => ({ ...prev, niche: value === "all" ? undefined : value }),
                    replace: true,
                  })
                }
              >
                <SelectTrigger size="sm" className="w-full max-sm:h-9" aria-label="Nicho">
                  <span className="text-muted-foreground">Nicho</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {talkedNiches.map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {item.label}
                    </SelectItem>
                  ))}
                  {niche && !talkedNiches.some((item) => item.key === niche) ? (
                    <SelectItem value={niche}>{niche}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            ) : null}
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
                    const trigger = (
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
                        {item === "needsYou" ? (
                          <InfoIcon aria-hidden className="size-3.5 text-tertiary" />
                        ) : null}
                      </TabsTrigger>
                    );
                    // A tab cannot hold another button, so the tab itself carries the tip.
                    return item === "needsYou" ? (
                      <Hint key={item} label={GLOSSARY.needsYou.text}>
                        {trigger}
                      </Hint>
                    ) : (
                      trigger
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
          ) : rows.length === 0 && data.length > 0 && query.trim() ? (
            <EmptyState icon={SearchIcon} title={`Nenhuma conversa com “${query.trim()}”.`}>
              <Button variant="secondary" size="sm" onClick={clearSearch}>
                Limpar busca
              </Button>
            </EmptyState>
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
            <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {rows.map((row) => {
                const selectedRow = row.id === openId;
                const unread = row.state === "needsYou";
                return (
                  <li key={row.id} className="grouped-row [--inset:28px]">
                    <button
                      type="button"
                      onClick={() => select(row.id)}
                      data-row={row.id}
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
  const queryClient = useQueryClient();
  const today = useToday();
  const [text, setText] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Where the caret was in the reply; null until the user puts it somewhere.
  const caret = useRef<number | null>(null);
  const setDraft = (draft: Email | null) =>
    queryClient.setQueryData(conversationQuery(leadId).queryKey, (old) =>
      old ? { ...old, draft } : old,
    );
  // The reply is saved as it is typed, so it survives switching conversations or reloading.
  const autosave = useAutosave(
    async (_key, body: string) => {
      const draft = await saveReplyDraft({ data: { leadId, body } });
      // Cleared: whatever the AI had drafted shows again.
      if (draft) setDraft(draft);
      else await queryClient.invalidateQueries({ queryKey: conversationQuery(leadId).queryKey });
    },
    errorToast("Não foi possível salvar o rascunho", { id: "reply-draft" }),
  );

  const send = useMutation({
    mutationFn: async (body: string) => {
      await autosave.flush();
      return sendReply({ data: { leadId, body } });
    },
    onSuccess: async () => {
      setDraft(null);
      setText(null);
      await refresh();
      toast.success("Enviado");
    },
    onError: (error) => {
      errorToast("Não foi possível enviar")(error);
      // A send that failed stays in the thread, with "Tentar de novo".
      void refresh();
    },
  });
  // Puts back what the composer had before the AI wrote. Runs from the toast, which may
  // outlive this thread; a reply the AI only suggested comes back by removing the user's own.
  const restoreReply = async (previous: PreviousReply) => {
    try {
      await autosave.discard(leadId);
      const draft = await saveReplyDraft({
        data: { leadId, body: previous.mine ? previous.body : "" },
      });
      setText(null);
      if (draft) setDraft(draft);
      else await queryClient.invalidateQueries({ queryKey: conversationQuery(leadId).queryKey });
    } catch (error) {
      errorToast("Não foi possível desfazer")(error);
    }
  };
  const write = useMutation({
    mutationFn: async (_previous: PreviousReply) => {
      // Saved first: the server rewrites what the composer shows.
      await autosave.flush();
      return draftReplyWithAi({ data: { leadId } });
    },
    onSuccess: (draft, previous) => {
      setDraft(draft);
      setText(null);
      toast(previous.body.trim() ? "Resposta reescrita pela IA" : "Resposta escrita pela IA", {
        duration: 6000,
        action: { label: "Desfazer", onClick: () => void restoreReply(previous) },
      });
    },
    onError: errorToast("A IA não conseguiu escrever agora. Tente de novo."),
  });
  // A quick reply goes where the caret was (at the end, on its own paragraph, otherwise)
  // and is saved like anything typed.
  const insertQuickReply = (snippet: string) => {
    const current = text ?? data?.draft?.body ?? "";
    const at = Math.min(caret.current ?? current.length, current.length);
    const gap = caret.current === null && current.trim() && !/\s$/.test(current) ? "\n\n" : "";
    const next = current.slice(0, at) + gap + snippet + current.slice(at);
    const end = at + gap.length + snippet.length;
    setText(next);
    autosave.schedule(leadId, next);
    caret.current = end;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(end, end);
    });
  };
  const ai = useMutation({
    mutationFn: (aiMode: boolean) => setConversationAi({ data: { leadId, aiMode } }),
    onSuccess: refresh,
    onError: errorToast("Não foi possível mudar a IA desta conversa"),
  });
  // Runs from the toast, which may outlive this thread (the user opened another one).
  const undoClose = async (snapshot: CloseSnapshot) => {
    try {
      await undoCloseConversation({ data: { leadId, ...snapshot } });
      await refresh();
    } catch (error) {
      errorToast("Não foi possível desfazer")(error);
    }
  };
  const close = useMutation({
    mutationFn: async (outcome: "closed" | "discarded") => {
      // Saved first, so the reply in progress is part of what the close keeps (and undo restores).
      await autosave.flush();
      return closeConversation({ data: { leadId, outcome } });
    },
    onSuccess: async (snapshot, outcome) => {
      await refresh();
      toast(outcome === "closed" ? "Conversa encerrada" : "Encerrada sem negócio", {
        duration: 6000,
        action: { label: "Desfazer", onClick: () => void undoClose(snapshot) },
      });
    },
    onError: errorToast("Não foi possível encerrar"),
  });
  const retry = useMutation({
    mutationFn: (emailId: string) => retryEmail({ data: { emailId } }),
    onSuccess: refresh,
    onError: errorToast("Não foi possível reenviar"),
  });
  const cancelQueued = useMutation({
    mutationFn: (emailId: string) => cancelQueuedEmail({ data: { emailId } }),
    onSuccess: refresh,
    onError: errorToast("Não foi possível cancelar o envio"),
  });
  const editQueued = useMutation({
    mutationFn: async (emailId: string) => {
      // What is in the composer is saved first; the server refuses to replace it.
      await autosave.flush();
      return editQueuedEmail({ data: { emailId } });
    },
    onSuccess: async (draft) => {
      setDraft(draft);
      setText(null);
      await refresh();
    },
    onError: errorToast("Não foi possível editar o e-mail"),
  });
  const reopen = useMutation({
    mutationFn: () => updateLead({ data: { id: leadId, status: "replied" } }),
    onSuccess: refresh,
    onError: errorToast("Não foi possível reabrir a conversa"),
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
  const canSend = value.trim() !== "" && !send.isPending;
  const writeLabel = write.isPending
    ? "Escrevendo…"
    : value.trim()
      ? "Reescrever"
      : "Escrever com IA";
  const savedDraft =
    text === null ? draft?.author === "user" : autosave.state === "saved" && text.trim() !== "";
  const closed = state === "closed";
  const blocker = closed ? reopenBlocker(lead) : null;
  const firstOut = messages.find((message) => message.direction === "out" && !message.inReplyTo);
  const messageActions: MessageActions = {
    today,
    canEdit: !closed && Boolean(lead.email),
    canRetry: !closed,
    busyId: retry.isPending
      ? retry.variables
      : cancelQueued.isPending
        ? cancelQueued.variables
        : editQueued.isPending
          ? editQueued.variables
          : undefined,
    onRetry: (id) => retry.mutate(id),
    onCancel: (id) => cancelQueued.mutate(id),
    onEdit: (id) => editQueued.mutate(id),
  };

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4 pb-3 sm:px-7">
          <Hint label="Voltar (Esc)">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={onBack}
              aria-label="Voltar"
            >
              <ChevronLeftIcon />
            </Button>
          </Hint>
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
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="text-blue"
              disabled={Boolean(blocker) || reopen.isPending}
              onClick={() => reopen.mutate()}
            >
              <RotateCcwIcon />
              {reopen.isPending ? "Reabrindo…" : "Reabrir conversa"}
            </Button>
          )}
          {lead.phoneE164 ? (
            <Button asChild size="sm" variant="secondary" className="text-green">
              <ExternalLink href={whatsappLink(lead.phoneE164)} indicator={false}>
                <MessageCircleIcon />
                WhatsApp
              </ExternalLink>
            </Button>
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
        {blocker ? (
          <p className="-mt-1 px-5 pb-3 text-xs font-light text-muted-foreground sm:px-7 xl:hidden">
            {blocker}
          </p>
        ) : null}

        <div className="scroll-fade min-h-0 flex-1 overflow-y-auto px-5 pb-4 sm:px-7">
          {firstOut ? (
            <h3 className="mt-1 mb-1 max-w-[68ch] text-2xl font-medium tracking-[-0.025em]">
              {firstOut.subject}
            </h3>
          ) : null}
          {messages.map((message) => (
            <Message
              key={message.id}
              message={message}
              leadName={lead.name}
              actions={messageActions}
            />
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
            <div className="@container rounded-[18px] bg-card shadow-[inset_0_1px_0_rgb(255_255_255/0.1),inset_0_0_0_1px_rgb(255_255_255/0.06),0_16px_36px_rgb(0_0_0/0.4)] [:root:not(.dark)_&]:shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_rgb(0_0_0/0.08)]">
              <div className="flex min-w-0 items-center gap-2 px-4 pt-3 text-[12.5px] text-muted-foreground">
                Para
                <span className="min-w-0 truncate rounded-full bg-fill-2 px-2.5 py-0.5 text-[11.5px] font-medium text-foreground">
                  {lead.email}
                </span>
                {draft?.author === "ai" && text === null ? (
                  <Badge variant="purple" className="ml-auto shrink-0">
                    <SparklesIcon />
                    <span className="max-sm:hidden">Rascunho da IA para você revisar</span>
                    <span className="sm:hidden">Rascunho da IA</span>
                  </Badge>
                ) : null}
              </div>
              <Textarea
                ref={textareaRef}
                aria-label="Sua resposta"
                rows={4}
                placeholder="Escreva sua resposta."
                value={value}
                readOnly={send.isPending || write.isPending}
                className="bg-transparent! px-4 text-base leading-[1.7] shadow-none! focus-visible:ring-0"
                onChange={(event) => {
                  setText(event.target.value);
                  autosave.schedule(leadId, event.target.value);
                }}
                onKeyDown={(event) => {
                  if (!isSendChord(event)) return;
                  event.preventDefault();
                  if (canSend) send.mutate(value);
                }}
                onSelect={(event) => {
                  caret.current = event.currentTarget.selectionEnd;
                }}
              />
              {/* One row at any width: the AI buttons drop their labels when the composer is narrow. */}
              <div className="flex items-center justify-end gap-1.5 px-2 pt-1 pb-2 @lg:gap-2">
                <div className="mr-auto flex min-w-0 items-center gap-1.5">
                  <QuickReplyPicker
                    disabled={send.isPending || write.isPending}
                    onPick={insertQuickReply}
                  />
                  <span
                    aria-live="polite"
                    className={cn(
                      "min-w-0 truncate text-xs font-light",
                      autosave.state === "error" ? "text-red" : "text-tertiary",
                      autosave.state === "idle" && !savedDraft && "max-sm:hidden",
                    )}
                  >
                    {autosave.state === "saving"
                      ? "Salvando…"
                      : autosave.state === "error"
                        ? "Rascunho não salvo"
                        : savedDraft
                          ? "Rascunho salvo"
                          : "A assinatura é adicionada no envio."}
                  </span>
                </div>
                <Hint label={writeLabel}>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={writeLabel}
                    className="shrink-0 text-purple @max-lg:w-7 @max-lg:px-0"
                    disabled={write.isPending || send.isPending}
                    onClick={() =>
                      write.mutate({ body: value, mine: text !== null || draft?.author === "user" })
                    }
                  >
                    <SparklesIcon />
                    <span className="@max-lg:sr-only">{writeLabel}</span>
                  </Button>
                </Hint>
                {state === "needsYou" ? (
                  <Hint label="Devolver para a IA">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label="Devolver para a IA"
                      className="shrink-0 text-purple @max-2xl:w-7 @max-2xl:px-0"
                      disabled={ai.isPending}
                      onClick={() => ai.mutate(true)}
                    >
                      <BotIcon />
                      <span className="@max-2xl:sr-only">Devolver para a IA</span>
                    </Button>
                  </Hint>
                ) : null}
                <Hint label={`Enviar ${sendShortcut()}`}>
                  <Button
                    size="sm"
                    className="shrink-0"
                    disabled={!canSend}
                    onClick={() => send.mutate(value)}
                  >
                    <SendIcon />
                    {send.isPending ? "Enviando…" : "Enviar"}
                  </Button>
                </Hint>
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
            {lead.phoneE164 ? (
              <Hint label="Abrir WhatsApp em nova aba">
                <ExternalLink
                  href={whatsappLink(lead.phoneE164)}
                  indicator={false}
                  className="press"
                  aria-label="WhatsApp"
                >
                  <IconTile icon={MessageCircleIcon} tone="green" size={32} round />
                </ExternalLink>
              </Hint>
            ) : null}
            {lead.phone ? (
              <Hint label="Ligar">
                <a href={`tel:${lead.phone}`} className="press" aria-label="Ligar">
                  <IconTile icon={PhoneIcon} tone="green" size={32} round />
                </a>
              </Hint>
            ) : null}
            {safeHttpUrl(lead.website) ? (
              <Hint label="Abrir site em nova aba">
                <ExternalLink
                  href={safeHttpUrl(lead.website) ?? undefined}
                  indicator={false}
                  className="press"
                  aria-label="Site"
                >
                  <IconTile icon={GlobeIcon} tone="gray" size={32} round />
                </ExternalLink>
              </Hint>
            ) : null}
          </div>
        </div>
        <div className="grouped">
          <PropertyRow label="Telefone">{lead.phone ?? "sem telefone"}</PropertyRow>
          <PropertyRow label="Site">
            {lead.website && !safeHttpUrl(lead.website) ? (
              <span className="break-all">{lead.website}</span>
            ) : lead.website ? (
              <ExternalLink
                href={safeHttpUrl(lead.website) ?? undefined}
                className="inline-flex items-center gap-1 text-blue hover:underline"
              >
                {lead.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </ExternalLink>
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
          ) : (
            <button
              type="button"
              disabled={Boolean(blocker) || reopen.isPending}
              onClick={() => reopen.mutate()}
              className="grouped-row flex min-h-[44px] w-full items-center gap-2 px-4 text-left font-medium text-blue [--inset:16px] hover:bg-fill-3 disabled:opacity-50"
            >
              <RotateCcwIcon className="size-4" />
              {reopen.isPending ? "Reabrindo…" : "Reabrir conversa"}
            </button>
          )}
        </div>
        {blocker ? (
          <p className="-mt-3 px-4 text-xs font-light text-muted-foreground">{blocker}</p>
        ) : null}
      </aside>
    </>
  );
}

/** What the composer had before the AI wrote: the text, and whether it was the user's own. */
type PreviousReply = { body: string; mine: boolean };

type MessageActions = {
  today: string;
  /** The composer is open, so a queued e-mail can go back to it. */
  canEdit: boolean;
  /** A closed conversation sends nothing; it has to be reopened first. */
  canRetry: boolean;
  busyId: string | undefined;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onEdit: (id: string) => void;
};

/** A link-sized action inside a message, still a 32px touch target. */
function MessageAction({
  busy,
  busyLabel,
  disabled,
  onClick,
  children,
}: {
  busy: boolean;
  busyLabel: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      variant="link"
      size="xs"
      className="h-8 px-1.5 text-xs"
      disabled={disabled}
      onClick={onClick}
    >
      {busy ? busyLabel : children}
    </Button>
  );
}

function Message({
  message,
  leadName,
  actions,
}: {
  message: Email;
  leadName: string;
  actions: MessageActions;
}) {
  const out = message.direction === "out";
  const fromAi = out && message.author === "ai";
  const who = out ? (fromAi ? "IA, em seu nome" : "Você") : leadName;
  const failed = message.status === "failed";
  const next = failed ? failedEmailAction(message, actions.today) : null;
  const alarming = failed && next !== "retried";
  // Queued with sent_at set means a send already picked it up.
  const waiting = message.status === "queued" && !message.sentAt;
  const when =
    message.status === "queued"
      ? !waiting
        ? "saindo agora"
        : message.sendAfter
          ? `na fila, sai ${shortTime(message.sendAfter)}`
          : "na fila"
      : failed
        ? next === "retried"
          ? "não enviado, reenviado"
          : `não enviado: ${message.error ?? "erro"}`
        : message.status === "cancelled"
          ? (message.error ?? "Cancelado")
          : message.sentAt
            ? shortTime(message.sentAt)
            : "";
  const busy = actions.busyId === message.id;
  const pending = actions.busyId !== undefined;
  // What we sent is shown whole; a reply hides the original it quotes until asked.
  const { visible, quoted } = out
    ? { visible: message.body, quoted: null }
    : splitQuoted(message.body);
  const [showQuoted, setShowQuoted] = useState(false);
  const quotedId = useId();
  return (
    <article
      className={cn(
        "grid max-w-[68ch] gap-2.5 border-b border-border/70 py-5",
        alarming && "border-l-2 border-l-red pl-3",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {fromAi ? (
          <IconTile icon={SparklesIcon} tone="purple" size={30} round />
        ) : (
          <Avatar name={out ? "Você" : leadName} size={30} />
        )}
        <span className={cn("font-medium", fromAi && "text-purple")}>{who}</span>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-x-1 text-xs tabular-nums">
          <span
            className={cn(
              alarming
                ? "text-red"
                : message.status === "queued"
                  ? "text-muted-foreground"
                  : "text-tertiary",
            )}
          >
            {when}
          </span>
          {next === "retry" && actions.canRetry ? (
            <MessageAction
              busy={busy}
              busyLabel="Reenviando…"
              disabled={pending}
              onClick={() => actions.onRetry(message.id)}
            >
              Tentar de novo
            </MessageAction>
          ) : next === "tomorrow" ? (
            <span className="text-muted-foreground">· Tenta amanhã</span>
          ) : null}
          {waiting && out ? (
            <>
              {actions.canEdit ? (
                <MessageAction
                  busy={busy}
                  busyLabel="Abrindo…"
                  disabled={pending}
                  onClick={() => actions.onEdit(message.id)}
                >
                  Editar
                </MessageAction>
              ) : null}
              <MessageAction
                busy={busy}
                busyLabel="Cancelando…"
                disabled={pending}
                onClick={() => actions.onCancel(message.id)}
              >
                Cancelar
              </MessageAction>
            </>
          ) : null}
        </span>
      </div>
      <p
        className={cn(
          "text-base leading-[1.7] whitespace-pre-line",
          message.status === "cancelled" ? "text-muted-foreground" : "text-foreground/85",
        )}
      >
        {visible}
      </p>
      {quoted ? (
        <div className="grid justify-items-start">
          <button
            type="button"
            aria-expanded={showQuoted}
            aria-controls={showQuoted ? quotedId : undefined}
            onClick={() => setShowQuoted((value) => !value)}
            className="-my-1 h-8 text-xs font-medium text-tertiary transition-colors hover:text-foreground"
          >
            {showQuoted ? "Ocultar" : "Mostrar mensagem anterior"}
          </button>
          {showQuoted ? (
            <p
              id={quotedId}
              className="mt-1 border-l-2 border-border pl-3 text-sm leading-relaxed font-light whitespace-pre-line text-muted-foreground"
            >
              {quoted}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

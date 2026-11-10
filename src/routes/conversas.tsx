import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  CircleCheckIcon,
  CircleXIcon,
  MessagesSquareIcon,
  PhoneIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import { z } from "zod";
import { lenientSearch } from "@/lib/schemas";
import { Avatar, EmptyState, ExternalLink, Hint } from "@/components/apple-ui";
import { Page } from "@/components/app-shell";
import { WhatsAppMark } from "@/components/brand-marks";
import {
  CONVERSATION_FILTERS,
  ConversationFilters,
} from "@/components/conversas/conversation-filters";
import { ConversationStateLabel } from "@/components/conversas/conversation-state-label";
import { ThreadHeader } from "@/components/conversas/thread-header";
import { HandoffNotice } from "@/components/conversas/handoff-notice";
import { LeadPanel } from "@/components/conversas/lead-panel";
import { NoConversationOpen } from "@/components/conversas/no-conversation-open";
import type { MessageActions } from "@/components/conversas/message-buttons";
import { ReplyComposer } from "@/components/conversas/reply-composer";
import { ThreadMessages } from "@/components/conversas/thread-messages";
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
import type { Email } from "@/db/schema";
import { useAutosave } from "@/lib/autosave";
import { shortTime } from "@/lib/format";
import {
  conversationQuery,
  conversationsQuery,
  invalidateLeadScreens,
  leadSalesQuery,
  nichesQuery,
  providerStatusQuery,
} from "@/lib/queries";
import { useToday } from "@/lib/today";
import { conversationOwner } from "@/lib/conversation-owner";
import { replySendState } from "@/lib/reply-send";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import { cn } from "@/lib/utils";
import { reopenBlocker } from "@/server/lead-status";
import { updateLead } from "@/server/leads";
import {
  cancelQueuedEmail,
  checkMailNow,
  draftReplyWithAi,
  editQueuedEmail,
  retryEmail,
  saveReplyDraft,
  sendReply,
  setConversationAi,
} from "@/server/mail";
import { pageTitle } from "@/lib/page-title";
import { isSendChord } from "@/lib/shortcuts";
import { matchesQuery } from "@/lib/text-search";
import { useUrlSearchBox } from "@/hooks/use-url-search-box";
import { whatsappLink } from "@/lib/phone";
import { useListHotkeys } from "@/hooks/use-list-hotkeys";
import { useLeadDeal } from "@/hooks/use-lead-deal";
import { useLeadPanelOpen } from "@/hooks/use-lead-panel-open";
import { useReadLeadReplies } from "@/hooks/use-read-lead-replies";
import { CloseDealDialog, type CloseDealMode } from "@/components/lead/close-deal-dialog";

const FILTERS = CONVERSATION_FILTERS;
type Filter = (typeof FILTERS)[number];

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
  // Conversations, lists, goal, metrics, niches and agenda all show the lead's status.
  return () => invalidateLeadScreens(queryClient);
}

function ConversationsPage() {
  const { lead: openId, filter = "all", q: urlQuery = "", niche } = Route.useSearch();
  const navigate = useNavigate({ from: "/conversas" });
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Lives here, not in the thread, so hiding it holds while you move between conversations.
  const leadPanel = useLeadPanelOpen();
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
            "enter flex min-h-0 flex-col border-border/70 lg:border-r",
            openId && "max-lg:hidden",
          )}
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3 px-4 pt-4 pb-3">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tertiary" />
              <Input
                ref={searchRef}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                aria-label="Buscar conversa"
                placeholder="Buscar por nome ou e-mail"
                className={cn("h-10 rounded-full pl-9", query && "pr-10")}
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
                    className="absolute top-1/2 right-1 -translate-y-1/2"
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
            <ConversationFilters
              value={filter}
              countOf={countOf}
              onChange={(next) => void navigate({ search: (prev) => ({ ...prev, filter: next }) })}
            />
          </div>
          {data === undefined ? (
            <div className="grid gap-2 p-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : rows.length === 0 && data.length > 0 && query.trim() ? (
            <EmptyState icon={SearchIcon} title={`Nenhuma conversa com “${query.trim()}”.`}>
              <Button variant="outline" size="sm" onClick={clearSearch}>
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
            <ul
              ref={listRef}
              className="grid min-h-0 flex-1 content-start gap-0.5 overflow-y-auto overscroll-contain px-2 pb-3"
            >
              {rows.map((row) => {
                const selectedRow = row.id === openId;
                const unread = row.state === "needsYou";
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => select(row.id)}
                      data-row={row.id}
                      aria-current={selectedRow || undefined}
                      className={cn(
                        "grid w-full grid-cols-[12px_minmax(0,1fr)] gap-1.5 rounded-[14px] border py-3 pr-3 pl-2 text-left transition-[background-color,border-color] duration-150 ease-spring",
                        selectedRow
                          ? "border-border bg-fill-2"
                          : "border-transparent hover:bg-fill-3",
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
                          <span className="shrink-0 text-[13px] text-tertiary tabular-nums">
                            {row.lastEmailAt ? shortTime(row.lastEmailAt) : ""}
                          </span>
                        </span>
                        <span className="line-clamp-2 text-sm text-muted-foreground">
                          {row.preview}
                        </span>
                        <span>
                          <ConversationStateLabel state={row.state} />
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
          <Thread
            key={openId}
            leadId={openId}
            onBack={() => select(undefined)}
            panelOpen={leadPanel.open}
            onTogglePanel={leadPanel.toggle}
          />
        ) : (
          <div
            className="enter hidden items-center justify-center lg:flex"
            style={{ animationDelay: "40ms" }}
          >
            <NoConversationOpen nextLeadId={data?.find((row) => row.state === "needsYou")?.id} />
          </div>
        )}
      </div>
    </Page>
  );
}

function Thread({
  leadId,
  onBack,
  panelOpen,
  onTogglePanel,
}: {
  leadId: string;
  onBack: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
}) {
  const { data } = useQuery(conversationQuery(leadId));
  const { data: providerStatus } = useQuery(providerStatusQuery);
  useReadLeadReplies(leadId, data?.messages);
  // Opens on the newest message and follows new ones while the user is at the bottom.
  const { ref: threadRef, onScroll: onThreadScroll } = useStickToBottom(
    data ? `${data.messages.length}:${data.messages.at(-1)?.id ?? ""}:${data.state}` : null,
  );
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
      if (draft) {
        setDraft(draft);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: conversationQuery(leadId).queryKey });
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
      if (draft) {
        setDraft(draft);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: conversationQuery(leadId).queryKey });
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
  // "Fechar negócio" and "Encerrar sem negócio" open the lead panel's forms in a dialog. The
  // reply in progress is saved first, so it is part of what the close keeps (and undo restores).
  const [closing, setClosing] = useState<CloseDealMode | null>(null);
  const deal = useLeadDeal(leadId, {
    onChanged: () => queryClient.invalidateQueries({ queryKey: leadSalesQuery(leadId).queryKey }),
    beforeClose: () => autosave.flush(),
  });
  // The latest proposal, which "Fechar negócio" starts from.
  const { data: sales } = useQuery(leadSalesQuery(leadId));
  const closeDone = { onSuccess: () => setClosing(null) };
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
  const { canSend, reason: sendBlockedReason } = replySendState({
    body: value,
    pending: send.isPending,
    mailConfigured: providerStatus?.mail.configured,
  });
  // While the change is saving, the header already shows where it is going.
  const owner = conversationOwner(ai.isPending ? (ai.variables ?? lead.aiMode) : lead.aiMode);
  const writeLabel = write.isPending
    ? "Escrevendo…"
    : value.trim()
      ? "Reescrever"
      : "Escrever com IA";
  const savedDraft =
    text === null ? draft?.author === "user" : autosave.state === "saved" && text.trim() !== "";
  const saveNote =
    autosave.state === "saving"
      ? "Salvando…"
      : autosave.state === "error"
        ? "Rascunho não salvo"
        : savedDraft
          ? "Rascunho salvo"
          : "A assinatura é adicionada no envio.";
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
      <div
        className={cn("enter flex min-h-0 min-w-0 flex-col", !panelOpen && "xl:col-span-2")}
        style={{ animationDelay: "40ms" }}
      >
        <ThreadHeader
          name={lead.name}
          email={lead.email}
          closed={closed}
          owner={owner}
          ownerBusy={ai.isPending}
          panelOpen={panelOpen}
          onBack={onBack}
          onOwnerChange={(aiMode) => ai.mutate(aiMode)}
          onTogglePanel={onTogglePanel}
        />

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-5 py-3 sm:px-7 xl:hidden">
          {!closed ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={deal.closing}
                onClick={() => setClosing("won")}
              >
                <CircleCheckIcon className="text-green" />
                Fechar negócio
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={deal.closing}
                onClick={() => setClosing("lost")}
              >
                <CircleXIcon />
                Encerrar sem negócio
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={Boolean(blocker) || reopen.isPending}
              onClick={() => reopen.mutate()}
            >
              <RotateCcwIcon />
              {reopen.isPending ? "Reabrindo…" : "Reabrir conversa"}
            </Button>
          )}
          {lead.phoneE164 ? (
            <Hint label="Abrir WhatsApp em nova aba">
              <Button asChild size="icon-sm" variant="outline" aria-label="WhatsApp">
                <ExternalLink href={whatsappLink(lead.phoneE164)} indicator={false}>
                  <WhatsAppMark className="text-green" />
                </ExternalLink>
              </Button>
            </Hint>
          ) : null}
          {lead.phone ? (
            <Hint label="Ligar">
              <Button asChild size="icon-sm" variant="outline" aria-label="Ligar">
                <a href={`tel:${lead.phoneE164 ?? lead.phone}`}>
                  <PhoneIcon className="text-green" />
                </a>
              </Button>
            </Hint>
          ) : null}
          <Button asChild size="sm" variant="link">
            <Link to="/leads" search={{ view: "all", lead: lead.id }}>
              Ver lead
              <ChevronRightIcon />
            </Link>
          </Button>
        </div>
        {blocker ? (
          <p className="px-5 pt-2 text-[13px] text-muted-foreground sm:px-7 xl:hidden">{blocker}</p>
        ) : null}

        <div
          ref={threadRef}
          onScroll={onThreadScroll}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7"
        >
          <div className="mx-auto grid max-w-[880px] gap-4">
            {firstOut ? (
              <h3 className="text-[22px] leading-tight font-semibold tracking-[-0.01em]">
                {firstOut.subject}
              </h3>
            ) : null}
            <ThreadMessages messages={messages} leadName={lead.name} actions={messageActions} />
            {state === "needsYou" ? <HandoffNotice reason={lead.handoffReason} /> : null}
          </div>
        </div>

        {!closed && lead.email ? (
          <div className="px-4 pb-4 sm:px-5">
            <div className="mx-auto max-w-[880px]">
              <ReplyComposer
                email={lead.email}
                aiDraft={draft?.author === "ai" && text === null}
                note={saveNote}
                noteIsError={autosave.state === "error"}
                textareaRef={textareaRef}
                textarea={{
                  "aria-label": "Sua resposta",
                  placeholder: "Escreva sua resposta.",
                  value,
                  readOnly: send.isPending || write.isPending,
                  onChange: (event) => {
                    setText(event.target.value);
                    autosave.schedule(leadId, event.target.value);
                  },
                  onKeyDown: (event) => {
                    if (!isSendChord(event)) return;
                    event.preventDefault();
                    if (canSend) send.mutate(value);
                  },
                  onSelect: (event) => {
                    caret.current = event.currentTarget.selectionEnd;
                  },
                }}
                quickReply={{
                  disabled: send.isPending || write.isPending,
                  onPick: insertQuickReply,
                }}
                write={{
                  label: writeLabel,
                  disabled: write.isPending || send.isPending,
                  onClick: () =>
                    write.mutate({ body: value, mine: text !== null || draft?.author === "user" }),
                }}
                send={{
                  label: "Enviar",
                  pending: send.isPending,
                  blockedReason: sendBlockedReason,
                  disabled: !canSend,
                  onClick: () => send.mutate(value),
                }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {panelOpen ? (
        <LeadPanel
          lead={lead}
          state={state}
          summary={summary}
          closed={closed}
          blocker={blocker}
          busy={{ closing: deal.closing, reopening: reopen.isPending }}
          onWon={() => setClosing("won")}
          onLost={() => setClosing("lost")}
          onReopen={() => reopen.mutate()}
        />
      ) : null}
      <CloseDealDialog
        mode={closed ? null : closing}
        leadName={lead.name}
        today={today}
        proposal={sales?.proposal ?? null}
        busy={deal.closing}
        onWon={(won) => deal.closeWon(won, closeDone)}
        onLost={(lost) => deal.closeLost(lost, closeDone)}
        onClose={() => setClosing(null)}
      />
    </>
  );
}

/** What the composer had before the AI wrote: the text, and whether it was the user's own. */
type PreviousReply = { body: string; mine: boolean };

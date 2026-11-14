import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import {
  CalendarIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  ContactIcon,
  HistoryIcon,
  LoaderCircleIcon,
  MailIcon,
  RefreshCwIcon,
  SearchXIcon,
  SparklesIcon,
  StickyNoteIcon,
  XCircleIcon,
} from "@/components/icons";
import {
  DisabledReason,
  EmptyState,
  ExternalLink,
  SaveStatus,
  TONE_TEXT,
  type Tone,
} from "@/components/apple-ui";
import { SegmentedControl } from "@/components/notifications/segmented-control";
import { Notice } from "@/components/lead/notice";
import { PANEL_FIELD, PanelSection, TitleChip } from "@/components/lead/panel-section";
import { QuickActions } from "@/components/lead/quick-actions";
import { InlineEdit } from "@/components/inline-edit";
import { useReportUnsavedEdits } from "@/components/unsaved-edits";
import { DealActions } from "@/components/lead/deal-actions";
import { LeadHistory } from "@/components/lead/lead-history";
import { LeadMeetings } from "@/components/lead/lead-meetings";
import { LeadStage } from "@/components/lead/lead-stage";
import { OwnerChip } from "@/components/lead/owner-chip";
import { SalesActions } from "@/components/lead/sales-actions";
import { ScoreRing } from "@/components/lead/score-ring";
import { followUpTone } from "@/components/lead-badges";
import { WhatsAppMark } from "@/components/brand-marks";
import { LeadAvatar } from "@/components/leads/lead-avatar";
import { StageLabel } from "@/components/leads/stage-label";
import { leadStage } from "@/lib/lead-row";
import { useLeadDeal } from "@/hooks/use-lead-deal";
import { useReadLeadReplies } from "@/hooks/use-read-lead-replies";
import { useLeadSales, type LeadSales } from "@/hooks/use-lead-sales";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Analysis, Lead, LeadStatus, SiteStatus } from "@/db/schema";
import { useAutosave } from "@/lib/autosave";
import type { LostDeal, WonDeal } from "@/lib/deal-form";
import { historyLines } from "@/lib/lead-history";
import { isPriceHandoff } from "@/lib/lead-stage";
import { formatCents } from "@/lib/money";
import { addDays, formatDate, formatUsd, localDay, relativeDay } from "@/lib/format";
import { CONTACT_LIMITS, type ContactField } from "@/lib/lead-contact";
import { MANUAL_SEARCH_ID } from "@/lib/searches";
import { whatsappLink } from "@/lib/phone";
import {
  conversationQuery,
  invalidateLeadScreens,
  leadQuery,
  providerStatusQuery,
} from "@/lib/queries";
import {
  isCalendarDay,
  LEAD_NOT_FOUND,
  LOSS_REASON_LABELS,
  type UpdateLeadInput,
} from "@/lib/schemas";
import { cn, safeHttpUrl } from "@/lib/utils";
import { SCORE_LABEL_HELP } from "@/lib/score-label";
import { useToday } from "@/lib/today";
import {
  generateMessage,
  reanalyzeLead,
  updateFirstMessage,
  updateLead,
  updateLeadContact,
} from "@/server/leads";
import { reopenBlocker, UNSUBSCRIBED_MESSAGE } from "@/server/lead-status";
import type { IconComponent } from "@/components/icons";
import { dispatchEmails, prepareEmails, rewriteDraft, updateDraft } from "@/server/mail";

const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  pending: "ainda não lido",
  none: "",
  ok: "lido",
  unreachable: "fora do ar",
  blocked: "bloqueado pelo robots.txt",
};

const FOLLOW_UP_OPTIONS = [
  { days: 1, label: "Amanhã" },
  { days: 3, label: "Em 3 dias" },
  { days: 7, label: "Em 1 semana" },
  { days: 14, label: "Em 2 semanas" },
] as const;

const FOLLOW_UP_CHOICES = FOLLOW_UP_OPTIONS.map((option) => ({
  value: String(option.days),
  label: option.label,
}));

type LeadUpdate = Omit<UpdateLeadInput, "id">;
type DraftText = { subject: string; body: string };

/** The next-step card: the same bordered card as every other block of the panel. */
const STEP_CARD = "rounded-[20px] border border-foreground/15 bg-card-2! shadow-none!";

/**
 * One lead inside the side sheet, organized around the next thing to do with it.
 * `toolbar` sits above the header (the pager); `onStatusChanged` lets the list move on
 * once the lead leaves the current view.
 */
export function LeadDetail({
  leadId,
  toolbar,
  onStatusChanged,
}: {
  leadId: string;
  toolbar?: ReactNode;
  onStatusChanged?: (status: LeadStatus) => void;
}) {
  const { data, error, refetch, isFetching } = useQuery(leadQuery(leadId));
  const queryClient = useQueryClient();
  const today = useToday();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
  const refreshAll = () => Promise.all([refresh(), invalidateLeadScreens(queryClient)]);

  const update = useMutation({
    mutationFn: (changes: LeadUpdate) => updateLead({ data: { id: leadId, ...changes } }),
    onSuccess: async (_result, changes) => {
      await refreshAll();
      if (changes.status) onStatusChanged?.(changes.status);
    },
    onError: errorToast("Não foi possível atualizar o lead"),
  });
  const deal = useLeadDeal(leadId, { onChanged: refreshAll, onStatusChanged });
  const sales = useLeadSales(leadId, { onChanged: refreshAll });

  if (!data && error) {
    return (
      <DetailError
        toolbar={toolbar}
        missing={error.message === LEAD_NOT_FOUND}
        retrying={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data) return <DetailSkeleton toolbar={toolbar} />;
  const { lead, analysis, search, owner, events, me } = data;
  const facts = [
    search?.id === MANUAL_SEARCH_ID
      ? "Adicionado manualmente"
      : search
        ? `${search.niche}, ${search.city}`
        : lead.city,
    lead.rating !== null
      ? `${lead.rating.toFixed(1).replace(".", ",")} no Google (${lead.reviewCount ?? 0})`
      : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col">
      <SheetHeader className="gap-4 px-6 pt-3.5 pb-4">
        {toolbar}
        <div className="flex items-start gap-3.5">
          <LeadAvatar
            name={lead.name}
            website={lead.website}
            size={48}
            className="rounded-[14px]"
          />
          <div className="grid min-w-0 flex-1 gap-1">
            <SheetTitle className="text-lg leading-7 font-semibold tracking-[-0.01em] wrap-break-word">
              {lead.name}
            </SheetTitle>
            <SheetDescription>{facts.join(" · ")}</SheetDescription>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StageLabel stage={leadStage(lead)} className="mr-1.5 text-sm" />
              <OwnerChip
                ownerName={owner?.name ?? null}
                mine={Boolean(me) && lead.ownerId === me}
                busy={deal.changingOwner}
                onTake={deal.take}
                onRelease={deal.release}
              />
              {lead.followUpOn && (lead.status === "contacted" || lead.status === "replied") ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <ClockIcon
                    className={cn("size-3.5", TONE_TEXT[followUpTone(lead.followUpOn, today)])}
                  />
                  Retorno {relativeDay(lead.followUpOn, today)}
                </span>
              ) : null}
            </div>
          </div>
          <ScoreRing score={lead.score} pending={lead.analysisStatus === "pending"} />
        </div>
        {lead.discardReason && !lead.lossReason ? (
          <Notice icon={XCircleIcon} tone="red">
            Descartado pela IA: {lead.discardReason}
          </Notice>
        ) : null}
        <QuickActions lead={lead} />
        <LeadStage lead={lead} busy={deal.movingStage} onSelectStage={deal.setStage} />
        {lead.status === "replied" && isPriceHandoff(lead.handoffReason) ? (
          <Notice icon={CircleAlertIcon} tone="orange">
            A IA não cita preço. Responda com a proposta da tabela de serviços.
          </Notice>
        ) : null}
      </SheetHeader>

      <div className="flex flex-col gap-4 px-6 pb-6">
        <NextStep
          lead={lead}
          analysis={analysis}
          today={today}
          busy={update.isPending}
          onUpdate={(changes, options) => update.mutate(changes, options)}
          onChanged={refreshAll}
          closing={deal.closing}
          onWon={deal.closeWon}
          onLost={deal.closeLost}
          sales={sales}
        />
        {sales.meetings.length > 0 ? (
          <PanelSection title="Reuniões" icon={CalendarIcon}>
            <LeadMeetings
              meetings={sales.meetings}
              today={today}
              busy={sales.cancelling}
              onCancel={sales.cancel}
            />
          </PanelSection>
        ) : null}
        <AnalysisSection lead={lead} analysis={analysis} />
        <div className="grid gap-4">
          <ContactSection lead={lead} onChanged={refreshAll} />
          <NotesSection
            key={lead.id}
            lead={lead}
            onSave={(notes) => update.mutateAsync({ notes })}
          />
        </div>
        <PanelSection title="Histórico" icon={HistoryIcon}>
          <LeadHistory lines={historyLines(events)} />
        </PanelSection>
        <Footer lead={lead} analysis={analysis} onChanged={refreshAll} />
      </div>
    </div>
  );
}

type StepProps = {
  lead: Lead;
  analysis: Analysis | null;
  today: string;
  busy: boolean;
  /** `onSuccess` runs once the server accepted the change (a toast must not promise earlier). */
  onUpdate: (changes: LeadUpdate, options?: { onSuccess?: () => void }) => void;
  onChanged: () => Promise<unknown>;
  /** A deal being closed (won or lost) right now. */
  closing: boolean;
  onWon: (deal: WonDeal) => void;
  onLost: (deal: LostDeal) => void;
  /** Meetings, proposals and the latest proposal "Fechar negócio" starts from. */
  sales: LeadSales;
};

function NextStep(props: StepProps) {
  const { lead, analysis, busy, onUpdate } = props;
  if (lead.lastEmailAt) return <ConversationStep {...props} />;
  const reopenReason = reopenBlocker(lead);
  switch (lead.status) {
    case "new":
      return lead.email && !lead.unsubscribedAt ? (
        <EmailStep key={lead.id} {...props} />
      ) : (
        <FirstContactStep
          key={`${analysis?.id ?? "none"}:${analysis?.firstMessage ?? ""}`}
          {...props}
        />
      );
    case "contacted":
      return <WaitingStep {...props} />;
    case "replied":
      return (
        <Card className={STEP_CARD}>
          <CardHeader>
            <CardTitle>Em conversa</CardTitle>
            <CardDescription>Anote nas notas o que foi combinado.</CardDescription>
          </CardHeader>
          <CardContent>
            <FollowUpPicker {...props} label="Próximo contato" />
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            {lead.phoneE164 ? (
              <Button size="sm" asChild variant="outline">
                <ExternalLink href={whatsappLink(lead.phoneE164)}>Abrir conversa</ExternalLink>
              </Button>
            ) : null}
            <SalesActions
              key={`sales:${lead.id}`}
              lead={lead}
              sales={props.sales}
              today={props.today}
            />
            <DealActions
              key={lead.id}
              today={props.today}
              proposal={props.sales.proposal}
              busy={busy || props.closing}
              onWon={props.onWon}
              onLost={props.onLost}
            />
          </CardFooter>
        </Card>
      );
    case "closed":
      return (
        <Card className={STEP_CARD}>
          <CardHeader>
            <CardTitle>Negócio fechado</CardTitle>
            <DealSummary lead={lead} />
          </CardHeader>
          <CardFooter>
            <DisabledReason reason={reopenReason ?? false}>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || reopenReason !== null}
                onClick={() => onUpdate({ status: "replied" })}
              >
                Reabrir conversa
              </Button>
            </DisabledReason>
          </CardFooter>
        </Card>
      );
    default:
      return (
        <Card className={STEP_CARD}>
          <CardHeader>
            <CardTitle>{lead.lossReason ? "Encerrado sem negócio" : "Descartado"}</CardTitle>
            <LossSummary lead={lead} />
          </CardHeader>
          <CardFooter>
            {/* The server refuses outreach for an opted-out lead; say so instead of failing. */}
            <DisabledReason reason={lead.unsubscribedAt ? UNSUBSCRIBED_MESSAGE : false}>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || lead.unsubscribedAt !== null}
                onClick={() => onUpdate({ status: "new" })}
              >
                Voltar para a fila
              </Button>
            </DisabledReason>
          </CardFooter>
        </Card>
      );
  }
}

function FirstContactStep({ lead, analysis, today, busy, onUpdate, onChanged }: StepProps) {
  const [message, setMessage] = useState(analysis?.firstMessage ?? "");
  const [followUpDays, setFollowUpDays] = useState("3");
  const saved = analysis?.firstMessage ?? "";
  const hasMessage = message.trim().length > 0;
  const dirty = message !== saved && analysis !== null;
  useReportUnsavedEdits(dirty);

  const saveMessage = useMutation({
    mutationFn: () =>
      updateFirstMessage({ data: { analysisId: analysis?.id ?? "", firstMessage: message } }),
    onSuccess: onChanged,
    onError: errorToast("Não foi possível salvar a mensagem"),
  });
  const generate = useMutation({
    mutationFn: () => generateMessage({ data: { id: lead.id } }),
    onSuccess: onChanged,
    onError: errorToast("Não foi possível gerar a mensagem"),
  });

  // Sending is the one manual step: it opens WhatsApp and records the contact.
  const markContacted = async () => {
    // Saved first: marking contacted closes this step, and an edit lost then is gone for good.
    if (dirty) {
      try {
        await saveMessage.mutateAsync();
      } catch {
        return; // saveMessage already showed the error; the lead stays as it was
      }
    }
    const followUpOn = addDays(today, Number(followUpDays));
    onUpdate(
      { status: "contacted", followUpOn },
      {
        onSuccess: () =>
          toast(`${lead.name}: contatado`, {
            // This step only shows for leads without a usable e-mail: the follow-up is manual.
            description: `Retorno ${relativeDay(followUpOn, today)}, pelo WhatsApp ou telefone.`,
            action: { label: "Desfazer", onClick: () => onUpdate({ status: "new" }) },
          }),
      },
    );
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Card className={STEP_CARD}>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <TitleChip icon={WhatsAppMark} tone="green" />
          <CardTitle>Primeira mensagem</CardTitle>
          {hasMessage ? <WrittenByAi /> : null}
        </div>
        <CardDescription>
          {hasMessage
            ? "Escrita pela IA. Revise e envie."
            : "A IA ainda não escreveu para este lead."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Textarea
          aria-label="Mensagem de primeiro contato"
          rows={6}
          placeholder={
            analysis ? "Gere uma mensagem ou escreva a sua." : "Disponível depois da análise."
          }
          className={cn("min-h-32", PANEL_FIELD)}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!analysis || generate.isPending}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span aria-hidden className="text-xs font-medium text-muted-foreground">
            Retorno
          </span>
          {/* Radio semantics: Tab reaches the chosen day, the arrow keys move the choice. */}
          <SegmentedControl
            label="Retorno"
            size="sm"
            value={followUpDays}
            options={FOLLOW_UP_CHOICES}
            onChange={setFollowUpDays}
            className="min-w-0 flex-1 flex-wrap"
          />
        </div>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {hasMessage && lead.phoneE164 ? (
          <Button size="sm" asChild disabled={busy}>
            <ExternalLink
              href={whatsappLink(lead.phoneE164, message)}
              onClick={() => void markContacted()}
            >
              Enviar pelo WhatsApp
            </ExternalLink>
          </Button>
        ) : null}
        {hasMessage && !lead.phoneE164 ? (
          <Button size="sm" disabled={busy} onClick={() => void markContacted()}>
            Marcar como contatado
          </Button>
        ) : null}
        {analysis ? (
          <Button
            size="sm"
            variant={hasMessage ? "outline" : "default"}
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            <SparklesIcon />
            {generate.isPending ? "Escrevendo…" : hasMessage ? "Gerar outra" : "Gerar mensagem"}
          </Button>
        ) : null}
        {hasMessage ? (
          <Button size="sm" variant="outline" onClick={() => void copy()}>
            Copiar
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={busy}
          onClick={() => onUpdate({ status: "discarded" })}
        >
          Descartar lead
        </Button>
      </CardFooter>
    </Card>
  );
}

/** WhatsApp contacts: waiting for an answer, with the follow-up day. */
function WaitingStep(props: StepProps) {
  const { lead, today, busy, onUpdate } = props;
  const contacted = lead.contactedAt ? relativeDay(localDay(lead.contactedAt), today) : null;
  return (
    <Card className={STEP_CARD}>
      <CardHeader>
        <CardTitle>Aguardando resposta</CardTitle>
        <CardDescription>{contacted ? `Contatado ${contacted}.` : "Contatado."}</CardDescription>
      </CardHeader>
      <CardContent>
        <FollowUpPicker {...props} label="Retorno" />
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {lead.phoneE164 ? (
          <Button size="sm" asChild variant="outline">
            <ExternalLink href={whatsappLink(lead.phoneE164)}>Abrir WhatsApp</ExternalLink>
          </Button>
        ) : null}
        <Button size="sm" disabled={busy} onClick={() => onUpdate({ status: "replied" })}>
          Respondeu
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={busy}
          onClick={() => onUpdate({ status: "discarded" })}
        >
          Descartar lead
        </Button>
      </CardFooter>
    </Card>
  );
}

/** First e-mail for a new lead: the AI writes it, the user reviews and sends. */
function EmailStep({ lead, busy, onUpdate, onChanged }: StepProps) {
  const { data } = useQuery(conversationQuery(lead.id));
  const queryClient = useQueryClient();
  const draft = data?.draft ?? null;
  const [edit, setEdit] = useState<DraftText | null>(null);
  const value = edit ?? (draft ? { subject: draft.subject, body: draft.body } : null);
  const refresh = () =>
    Promise.all([
      onChanged(),
      queryClient.invalidateQueries({ queryKey: ["conversations", lead.id] }),
    ]);

  // Edits are stored as they are typed, so closing the panel keeps them.
  const autosave = useAutosave(
    async (id, text: DraftText) => {
      await updateDraft({ data: { id, ...text } });
      queryClient.setQueryData(conversationQuery(lead.id).queryKey, (old) =>
        old?.draft?.id === id ? { ...old, draft: { ...old.draft, ...text } } : old,
      );
    },
    errorToast("Não foi possível salvar a edição", { id: "lead-draft" }),
  );
  const change = (next: DraftText) => {
    setEdit(next);
    if (!draft) return;
    // The server keeps the last complete version; an empty subject or body is not saved.
    if (next.subject.trim() && next.body.trim()) {
      autosave.schedule(draft.id, next);
      return;
    }
    void autosave.discard(draft.id);
  };
  // Runs from the toast, which may outlive the panel.
  const restore = async (id: string, previous: DraftText) => {
    try {
      await updateDraft({ data: { id, ...previous } });
      setEdit(null);
      await refresh();
    } catch (error) {
      errorToast("Não foi possível desfazer")(error);
    }
  };

  const write = useMutation({
    mutationFn: () => prepareEmails({ data: { leadIds: [lead.id] } }),
    onSuccess: async (result) => {
      if (result.skipped[0]) toast.error(`Não deu para escrever: ${result.skipped[0].reason}`);
      await refresh();
    },
    onError: errorToast("A IA não conseguiu escrever"),
  });
  const rewrite = useMutation({
    mutationFn: async ({ id }: { id: string; previous: DraftText }) => {
      await autosave.flush();
      return rewriteDraft({ data: { id } });
    },
    onSuccess: async (_draft, { id, previous }) => {
      setEdit(null);
      await refresh();
      toast("Nova versão gerada", {
        duration: 6000,
        action: { label: "Desfazer", onClick: () => void restore(id, previous) },
      });
    },
    onError: errorToast("Não foi possível reescrever"),
  });
  const send = useMutation({
    mutationFn: async () => {
      if (!draft || !value) return;
      await autosave.flush();
      if (edit) await updateDraft({ data: { id: draft.id, ...edit } });
      await dispatchEmails({ data: { ids: [draft.id] } });
    },
    onSuccess: async () => {
      setEdit(null);
      await refresh();
      // Queued: it goes out with the next send, within the daily limit and the gap.
      toast.success("E-mail na fila de envio", {
        description: "Sai em instantes. A resposta aparece em Conversas.",
      });
    },
    onError: errorToast("Não foi possível enviar"),
  });

  return (
    <Card className={STEP_CARD}>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <TitleChip icon={MailIcon} tone="blue" />
          <CardTitle>Primeiro e-mail</CardTitle>
          {draft ? <WrittenByAi /> : null}
        </div>
        <CardDescription>Para {lead.email}. A IA escreve, você revisa e envia.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {value && draft ? (
          <>
            <Input
              aria-label="Assunto"
              autoComplete="off"
              className={PANEL_FIELD}
              value={value.subject}
              readOnly={rewrite.isPending}
              onChange={(event) => change({ ...value, subject: event.target.value })}
            />
            <Textarea
              aria-label="Mensagem"
              rows={10}
              className={PANEL_FIELD}
              value={value.body}
              readOnly={rewrite.isPending}
              onChange={(event) => change({ ...value, body: event.target.value })}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum e-mail escrito ainda. Você também pode selecionar vários leads na lista e
            disparar de uma vez.
          </p>
        )}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {draft ? (
          <>
            <Button size="sm" disabled={send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? "Enviando…" : "Enviar e-mail"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={rewrite.isPending || !value}
              onClick={() => value && rewrite.mutate({ id: draft.id, previous: value })}
            >
              <SparklesIcon />
              {rewrite.isPending ? "Reescrevendo…" : "Gerar outro"}
            </Button>
            <SaveStatus state={autosave.state} className="self-center" />
          </>
        ) : (
          <Button size="sm" disabled={write.isPending} onClick={() => write.mutate()}>
            <SparklesIcon />
            {write.isPending ? "Escrevendo…" : "Escrever e-mail"}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={busy}
          onClick={() => onUpdate({ status: "discarded" })}
        >
          Descartar lead
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Leads with an e-mail thread: the latest messages and a way into Conversas. */
function ConversationStep({ lead, today, closing, onWon, onLost, sales }: StepProps) {
  const { data } = useQuery(conversationQuery(lead.id));
  useReadLeadReplies(lead.id, data?.messages);
  const last = data?.messages.slice(-2) ?? [];
  // A deal can be closed (won or lost) once the lead was contacted.
  const open = lead.status === "contacted" || lead.status === "replied";
  const label =
    data?.state === "needsYou"
      ? `A IA parou: ${lead.handoffReason ?? "respondeu"}. A conversa é sua.`
      : data?.state === "aiTalking"
        ? "A IA está conversando."
        : data?.state === "closed"
          ? "Conversa encerrada."
          : "Aguardando resposta.";
  return (
    <Card className={STEP_CARD}>
      <CardHeader>
        <CardTitle>Conversa por e-mail</CardTitle>
        <CardDescription>{label}</CardDescription>
        {lead.status === "closed" ? <DealSummary lead={lead} /> : null}
        {lead.status === "discarded" ? <LossSummary lead={lead} /> : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {last.map((message) => (
          <div
            key={message.id}
            className={
              message.direction === "out"
                ? "rounded-lg border px-3 py-2 text-base"
                : "rounded-lg bg-muted px-3 py-2 text-base"
            }
          >
            <p className="mb-1 text-xs text-muted-foreground">
              {message.direction === "in" ? "Empresa" : message.author === "ai" ? "IA" : "Você"}
            </p>
            <p className="line-clamp-4 whitespace-pre-line wrap-break-word">{message.body}</p>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Button size="sm" asChild variant={open ? "outline" : "default"}>
          <Link to="/conversas" search={{ lead: lead.id }}>
            Abrir conversa
          </Link>
        </Button>
        {lead.status === "replied" ? (
          <SalesActions key={`sales:${lead.id}`} lead={lead} sales={sales} today={today} />
        ) : null}
        {open ? (
          <DealActions
            key={lead.id}
            today={today}
            proposal={sales.proposal}
            busy={closing}
            onWon={onWon}
            onLost={onLost}
          />
        ) : null}
      </CardFooter>
    </Card>
  );
}

function FollowUpPicker({ lead, today, busy, onUpdate, label }: StepProps & { label: string }) {
  const value = lead.followUpOn;
  return (
    <div className="grid gap-2">
      <p className="text-sm">
        {label}:{" "}
        <span className="font-medium">{value ? relativeDay(value, today) : "sem data"}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {FOLLOW_UP_OPTIONS.slice(0, 3).map((option) => (
          <Button
            key={option.days}
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onUpdate({ followUpOn: addDays(today, option.days) })}
          >
            {option.label}
          </Button>
        ))}
        <Input
          type="date"
          aria-label={`${label}: escolher data`}
          value={value ?? ""}
          min={today}
          disabled={busy}
          // Typing the year fires a change per digit ("0002-…", "0020-…"); only a whole,
          // valid day from today on is saved.
          onChange={(event) => {
            const day = event.target.value;
            if (isCalendarDay(day) && day >= today) onUpdate({ followUpOn: day });
          }}
          className="h-8 w-auto tabular-nums [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
        />
      </div>
    </div>
  );
}

function AnalysisSection({ lead, analysis }: { lead: Lead; analysis: Analysis | null }) {
  const { data: status } = useQuery(providerStatusQuery);
  if (!analysis) {
    return (
      <PanelSection title="Análise" icon={SparklesIcon}>
        <p className="text-sm text-muted-foreground">
          {lead.analysisStatus === "error"
            ? `A análise falhou: ${lead.analysisError ?? "erro desconhecido"}. Tente reanalisar.`
            : lead.analysisStatus === "skipped"
              ? `${lead.analysisError ?? "Este lead ainda não foi analisado."} Use Reanalisar para analisar agora.`
              : "Lendo o site e avaliando. Esta tela atualiza sozinha."}
        </p>
      </PanelSection>
    );
  }
  const hasLists = analysis.signals.length > 0 || analysis.painPoints.length > 0;
  return (
    <PanelSection title="Análise" icon={SparklesIcon}>
      <div className="grid gap-4">
        <p className="text-base">{analysis.summary}</p>
        {hasLists ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <PlainList
              title="Oportunidades"
              tone="green"
              icon={CircleCheckIcon}
              items={analysis.signals}
            />
            <PlainList
              title="Dores prováveis"
              tone="orange"
              icon={CircleAlertIcon}
              items={analysis.painPoints}
            />
          </div>
        ) : status && !status.offerConfigured ? (
          <p className="text-sm text-muted-foreground">
            Para ver oportunidades,{" "}
            <Link
              to="/settings"
              search={{ aba: "ia" }}
              hash="oferta"
              className="text-foreground underline underline-offset-4"
            >
              descreva o que você vende
            </Link>{" "}
            e reanalise.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma oportunidade clara para a sua oferta.
          </p>
        )}
        <details className="group/details text-sm">
          <summary
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden",
            )}
          >
            <ChevronRightIcon className="size-3.5 transition-transform duration-300 ease-spring group-open/details:rotate-90" />
            Como a nota foi calculada
          </summary>
          <div className="mt-2 grid gap-2 leading-relaxed text-muted-foreground">
            <p>{analysis.scoreReasoning}</p>
            <p className="text-xs">{SCORE_LABEL_HELP}</p>
          </div>
        </details>
      </div>
    </PanelSection>
  );
}

function ContactSection({ lead, onChanged }: { lead: Lead; onChanged: () => Promise<unknown> }) {
  const site = lead.siteData;
  const siteEmails = (site?.emails ?? []).filter(
    (email) => email.toLowerCase() !== lead.email?.toLowerCase(),
  );
  const save = (field: ContactField) => async (value: string) => {
    try {
      await updateLeadContact({ data: { id: lead.id, field, value } });
    } catch (error) {
      errorToast("Não foi possível salvar")(error);
      throw error;
    }
    await onChanged();
  };
  const website = safeHttpUrl(lead.website);
  return (
    <PanelSection title="Contato" icon={ContactIcon}>
      <dl className="grid text-sm">
        <Term label="Nome">
          <InlineEdit
            label="nome"
            value={lead.name}
            placeholder="Adicionar nome"
            maxLength={CONTACT_LIMITS.name}
            onSave={save("name")}
          />
        </Term>
        <Term label="E-mail">
          <InlineEdit
            label="e-mail"
            value={lead.email}
            placeholder="Adicionar e-mail"
            inputType="email"
            maxLength={CONTACT_LIMITS.email}
            onSave={save("email")}
          />
          {siteEmails.length > 0 ? (
            <span className="block text-xs wrap-break-word text-muted-foreground">
              No site: {siteEmails.join(", ")}
            </span>
          ) : null}
        </Term>
        <Term label="Telefone">
          <InlineEdit
            label="telefone"
            value={lead.phone}
            placeholder="Adicionar telefone"
            display={<span className="tabular-nums">{lead.phone}</span>}
            inputType="tel"
            maxLength={CONTACT_LIMITS.phone}
            onSave={save("phone")}
          />
        </Term>
        <Term label="Site">
          <InlineEdit
            label="site"
            value={lead.website}
            placeholder="Adicionar site"
            inputType="url"
            maxLength={CONTACT_LIMITS.website}
            editOnValueClick={!website}
            onSave={save("website")}
            display={
              // A website that isn't http(s) is shown as text, never as a link.
              website ? (
                <>
                  <ExternalLink
                    href={website}
                    className="inline-flex items-center gap-1 break-all text-blue hover:underline"
                  >
                    {lead.website?.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                  </ExternalLink>
                  {SITE_STATUS_LABELS[lead.siteStatus] ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {SITE_STATUS_LABELS[lead.siteStatus]}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="break-all">{lead.website}</span>
              )
            }
          />
        </Term>
        {site && site.socialLinks.length > 0 ? (
          <Term label="Redes">
            {site.socialLinks.map((link) => (
              <ExternalLink
                key={link}
                href={safeHttpUrl(link) ?? undefined}
                className="flex min-w-0 items-center gap-1 text-blue hover:underline"
              >
                <span className="truncate">
                  {link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                </span>
              </ExternalLink>
            ))}
          </Term>
        ) : null}
        <Term label="Endereço">{lead.address ?? "Sem endereço"}</Term>
      </dl>
    </PanelSection>
  );
}

/** Saves when the field loses focus, so there is no button to remember; "Salvo" confirms it. */
function NotesSection({
  lead,
  onSave,
}: {
  lead: Lead;
  onSave: (notes: string) => Promise<unknown>;
}) {
  const [notes, setNotes] = useState(lead.notes);
  // Bumped on each save, so the 2 s of "Salvo" start over.
  const [savedAt, setSavedAt] = useState(0);
  useEffect(() => {
    const timer = savedAt ? setTimeout(() => setSavedAt(0), 2000) : undefined;
    return () => clearTimeout(timer);
  }, [savedAt]);
  return (
    <PanelSection
      title="Notas"
      icon={StickyNoteIcon}
      status={
        <span aria-live="polite" className="text-xs text-muted-foreground">
          {savedAt ? "Salvo" : ""}
        </span>
      }
    >
      <Textarea
        aria-label="Notas"
        rows={5}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        onBlur={() => {
          if (notes === lead.notes) return;
          // On failure the toast explains and the text stays in the field.
          onSave(notes).then(
            () => setSavedAt(Date.now()),
            () => {},
          );
        }}
        placeholder="Salvas ao sair do campo."
        className={cn("min-h-28", PANEL_FIELD)}
      />
    </PanelSection>
  );
}

function Footer({
  lead,
  analysis,
  onChanged,
}: {
  lead: Lead;
  analysis: Analysis | null;
  onChanged: () => Promise<unknown>;
}) {
  const analyzing = lead.analysisStatus === "pending";
  const reanalyze = useMutation({
    mutationFn: () => reanalyzeLead({ data: { id: lead.id } }),
    onSuccess: onChanged,
    onError: errorToast("Não foi possível iniciar a nova análise"),
  });

  return (
    <div className="flex flex-wrap items-center justify-end gap-4 border-t border-border/70 pt-4 text-sm text-muted-foreground">
      <div className="flex flex-wrap items-center gap-3">
        {analysis ? (
          <span className="text-xs text-muted-foreground">
            {analysis.model} · {formatUsd(analysis.costEstimate)} ·{" "}
            {formatDate(analysis.createdAt, true)}
          </span>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => reanalyze.mutate()}
          disabled={reanalyze.isPending || analyzing}
        >
          {analyzing ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
          {analyzing ? "Analisando…" : "Reanalisar"}
        </Button>
      </div>
    </div>
  );
}

/** "R$ 1.490 · Site institucional · 03/11/2026" of a won deal. */
function DealSummary({ lead }: { lead: Lead }) {
  const parts = [
    lead.dealValueCents !== null ? formatCents(lead.dealValueCents) : null,
    lead.dealService,
    lead.closedAt ? formatDate(lead.closedAt) : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <CardDescription className="tabular-nums">{parts.join(" · ")}</CardDescription>;
}

/** The loss reason and its note, when the deal was lost (not an AI discard). */
function LossSummary({ lead }: { lead: Lead }) {
  if (!lead.lossReason) return null;
  return (
    <CardDescription>
      {LOSS_REASON_LABELS[lead.lossReason]}
      {lead.lossNote ? `: ${lead.lossNote}` : ""}
    </CardDescription>
  );
}

/** "Escrito pela IA", as the badge standard draws it: a line icon, then neutral text. */
function WrittenByAi() {
  return (
    <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <SparklesIcon className="size-3.5 text-purple" />
      Escrito pela IA
    </span>
  );
}

function PlainList({
  title,
  tone,
  icon: Icon,
  items,
}: {
  title: string;
  tone: Tone;
  icon: IconComponent;
  items: string[];
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground">{title}</h4>
      {items.length > 0 ? (
        <ul className="grid gap-1.5 text-sm leading-relaxed">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_TEXT[tone])} />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma.</p>
      )}
    </div>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-11 grid-cols-[84px_minmax(0,1fr)] items-baseline gap-3 border-t border-foreground/10 py-2.5 first:border-t-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </div>
  );
}

/** A lead that couldn't load: gone (a removed lead, a stale link) or a failed request. */
function DetailError({
  toolbar,
  missing,
  retrying,
  onRetry,
}: {
  toolbar?: ReactNode;
  missing: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {toolbar}
      <SheetTitle className="sr-only">
        {missing ? "Lead não encontrado" : "Não foi possível abrir o lead"}
      </SheetTitle>
      <EmptyState
        icon={missing ? SearchXIcon : CircleAlertIcon}
        tone={missing ? "gray" : "orange"}
        title={missing ? "Lead não encontrado" : "Não foi possível abrir este lead"}
        description={
          missing
            ? "Ele pode ter sido removido, ou o link está desatualizado."
            : "Confira a conexão e tente de novo."
        }
      >
        {missing ? null : (
          <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
            {retrying ? "Tentando…" : "Tentar de novo"}
          </Button>
        )}
      </EmptyState>
    </div>
  );
}

function DetailSkeleton({ toolbar }: { toolbar?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {toolbar}
      <SheetTitle className="sr-only">Carregando lead</SheetTitle>
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

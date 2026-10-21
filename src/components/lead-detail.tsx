import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { errorToast } from "@/lib/mutation-toasts";
import {
  ChevronRightIcon,
  CircleAlertIcon,
  CopyIcon,
  GlobeIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  RefreshCwIcon,
  SearchXIcon,
  SparklesIcon,
} from "lucide-react";
import {
  Avatar,
  EmptyState,
  ExternalLink,
  ExternalMark,
  IconTile,
  InfoTip,
  ProgressRing,
  SaveStatus,
  TONE_TEXT,
  type Tone,
} from "@/components/apple-ui";
import { InlineEdit } from "@/components/inline-edit";
import { useReportUnsavedEdits } from "@/components/unsaved-edits";
import { GLOSSARY } from "@/lib/help";
import { followUpTone, StatusBadge, TIER_TONE } from "@/components/lead-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Analysis, Lead, LeadStatus, SiteStatus } from "@/db/schema";
import { useAutosave } from "@/lib/autosave";
import { addDays, formatDate, localDay, relativeDay } from "@/lib/format";
import { CONTACT_LIMITS, type ContactField } from "@/lib/lead-contact";
import { MANUAL_SEARCH_ID } from "@/lib/searches";
import { whatsappLink } from "@/lib/phone";
import { conversationQuery, leadQuery, providerStatusQuery } from "@/lib/queries";
import {
  isCalendarDay,
  LEAD_NOT_FOUND,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  SCORE_TIERS,
  scoreTier,
  type UpdateLeadInput,
} from "@/lib/schemas";
import { cn, safeHttpUrl } from "@/lib/utils";
import { useToday } from "@/lib/today";
import {
  generateMessage,
  reanalyzeLead,
  updateFirstMessage,
  updateLead,
  updateLeadContact,
} from "@/server/leads";
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

type LeadUpdate = Omit<UpdateLeadInput, "id">;
type DraftText = { subject: string; body: string };

const STEP_CARD = "shadow-[inset_3px_0_0_var(--green),inset_0_1px_0_rgb(255_255_255/0.05)]!";

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
  const refreshAll = () =>
    Promise.all([
      refresh(),
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);

  const update = useMutation({
    mutationFn: (changes: LeadUpdate) => updateLead({ data: { id: leadId, ...changes } }),
    onSuccess: async (_result, changes) => {
      await refreshAll();
      if (changes.status) onStatusChanged?.(changes.status);
    },
    onError: errorToast("Não foi possível atualizar o lead"),
  });

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
  const { lead, analysis, search } = data;
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
      <SheetHeader className="gap-4 px-5 pt-3.5 pb-4">
        {toolbar}
        <div className="flex items-center gap-3.5">
          <Avatar name={lead.name} size={52} square />
          <div className="grid min-w-0 flex-1 gap-1">
            <SheetTitle className="leading-snug">{lead.name}</SheetTitle>
            <SheetDescription>{facts.join(" · ")}</SheetDescription>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={lead.status} />
              {lead.followUpOn && (lead.status === "contacted" || lead.status === "replied") ? (
                <Badge variant={followUpTone(lead.followUpOn, today)} dot>
                  Retorno {relativeDay(lead.followUpOn, today)}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <ScoreRingLarge score={lead.score} pending={lead.analysisStatus === "pending"} />
            <InfoTip side="bottom">{GLOSSARY.score.text}</InfoTip>
          </div>
        </div>
        {lead.discardReason ? (
          <p className="text-[12.5px] text-red">Descartado pela IA: {lead.discardReason}</p>
        ) : null}
        <QuickActions lead={lead} />
      </SheetHeader>

      <div className="flex flex-col gap-6 px-5 pb-6">
        <NextStep
          lead={lead}
          analysis={analysis}
          today={today}
          busy={update.isPending}
          onUpdate={(changes, options) => update.mutate(changes, options)}
          onChanged={refreshAll}
        />
        <AnalysisSection lead={lead} analysis={analysis} />
        <div className="grid gap-6 sm:grid-cols-[1.2fr_1fr]">
          <ContactSection lead={lead} onChanged={refreshAll} />
          <NotesSection
            key={lead.id}
            lead={lead}
            onSave={(notes) => update.mutateAsync({ notes })}
          />
        </div>
        <Footer
          lead={lead}
          analysis={analysis}
          busy={update.isPending}
          onStatus={(status) => update.mutate({ status })}
          onChanged={refreshAll}
        />
      </div>
    </div>
  );
}

function QuickActions({ lead }: { lead: Lead }) {
  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(lead.phone ?? "");
      toast.success("Telefone copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
      {lead.phoneE164 ? (
        <>
          <QuickAction
            href={whatsappLink(lead.phoneE164)}
            external
            icon={MessageCircleIcon}
            tone="green"
          >
            WhatsApp
          </QuickAction>
          <QuickAction href={`tel:${lead.phoneE164}`} icon={PhoneIcon} tone="green">
            Ligar
          </QuickAction>
        </>
      ) : null}
      {lead.phone ? (
        <QuickAction as="button" onClick={() => void copyPhone()} icon={CopyIcon} tone="gray">
          Copiar telefone
        </QuickAction>
      ) : null}
      {safeHttpUrl(lead.website) ? (
        <QuickAction
          href={safeHttpUrl(lead.website) ?? undefined}
          external
          icon={GlobeIcon}
          tone="blue"
        >
          Site
        </QuickAction>
      ) : null}
      {safeHttpUrl(lead.mapsUrl) ? (
        <QuickAction
          href={safeHttpUrl(lead.mapsUrl) ?? undefined}
          external
          icon={MapPinIcon}
          tone="red"
        >
          Google Maps
        </QuickAction>
      ) : null}
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
};

function NextStep(props: StepProps) {
  const { lead, analysis, busy, onUpdate } = props;
  if (lead.lastEmailAt) return <ConversationStep {...props} />;
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
              <Button asChild variant="outline">
                <ExternalLink href={whatsappLink(lead.phoneE164)}>Abrir conversa</ExternalLink>
              </Button>
            ) : null}
            <Button disabled={busy} onClick={() => onUpdate({ status: "closed" })}>
              Fechar negócio
            </Button>
            <Button
              variant="ghost"
              className="ml-auto"
              disabled={busy}
              onClick={() => onUpdate({ status: "discarded" })}
            >
              Encerrar sem negócio
            </Button>
          </CardFooter>
        </Card>
      );
    case "closed":
      return (
        <Card className={STEP_CARD}>
          <CardHeader>
            <CardTitle>Negócio fechado</CardTitle>
          </CardHeader>
          <CardFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onUpdate({ status: "replied" })}
            >
              Reabrir conversa
            </Button>
          </CardFooter>
        </Card>
      );
    default:
      return (
        <Card className={STEP_CARD}>
          <CardHeader>
            <CardTitle>Descartado</CardTitle>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" disabled={busy} onClick={() => onUpdate({ status: "new" })}>
              Voltar para a fila
            </Button>
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
            description: `Retorno ${relativeDay(followUpOn, today)}. A IA prepara o e-mail de retorno.`,
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
          <IconTile icon={MessageCircleIcon} tone="green" size={26} />
          <CardTitle>Primeira mensagem</CardTitle>
          {hasMessage ? (
            <Badge variant="purple" className="ml-auto">
              Escrito pela IA
            </Badge>
          ) : null}
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
          className="min-h-32"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!analysis || generate.isPending}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          Retorno
          <Select value={followUpDays} onValueChange={setFollowUpDays}>
            <SelectTrigger size="sm" className="w-36" aria-label="Retorno">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FOLLOW_UP_OPTIONS.map((option) => (
                <SelectItem key={option.days} value={String(option.days)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        {hasMessage && lead.phoneE164 ? (
          <Button asChild disabled={busy}>
            <ExternalLink
              href={whatsappLink(lead.phoneE164, message)}
              onClick={() => void markContacted()}
            >
              Enviar no WhatsApp
            </ExternalLink>
          </Button>
        ) : null}
        {hasMessage && !lead.phoneE164 ? (
          <Button disabled={busy} onClick={() => void markContacted()}>
            Marcar como contatado
          </Button>
        ) : null}
        {analysis ? (
          <Button
            variant={hasMessage ? "outline" : "default"}
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            <SparklesIcon className="text-purple" />
            {generate.isPending ? "Escrevendo…" : hasMessage ? "Gerar outra" : "Gerar mensagem"}
          </Button>
        ) : null}
        {hasMessage ? (
          <Button variant="outline" onClick={() => void copy()}>
            Copiar
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="ml-auto hover:bg-red/15 hover:text-red"
          disabled={busy}
          onClick={() => onUpdate({ status: "discarded" })}
        >
          Descartar
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
          <Button asChild variant="outline">
            <ExternalLink href={whatsappLink(lead.phoneE164)}>Abrir WhatsApp</ExternalLink>
          </Button>
        ) : null}
        <Button disabled={busy} onClick={() => onUpdate({ status: "replied" })}>
          Respondeu
        </Button>
        <Button
          variant="ghost"
          className="ml-auto hover:bg-red/15 hover:text-red"
          disabled={busy}
          onClick={() => onUpdate({ status: "discarded" })}
        >
          Descartar
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
          <IconTile icon={SparklesIcon} tone="purple" size={26} />
          <CardTitle>Primeiro e-mail</CardTitle>
          {draft ? (
            <Badge variant="purple" className="ml-auto">
              Escrito pela IA
            </Badge>
          ) : null}
        </div>
        <CardDescription>Para {lead.email}. A IA escreve, você revisa e envia.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {value && draft ? (
          <>
            <Input
              aria-label="Assunto"
              autoComplete="off"
              value={value.subject}
              readOnly={rewrite.isPending}
              onChange={(event) => change({ ...value, subject: event.target.value })}
            />
            <Textarea
              aria-label="Mensagem"
              rows={10}
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
            <Button disabled={send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? "Enviando…" : "Enviar e-mail"}
            </Button>
            <Button
              variant="outline"
              disabled={rewrite.isPending || !value}
              onClick={() => value && rewrite.mutate({ id: draft.id, previous: value })}
            >
              <SparklesIcon className="text-purple" />
              {rewrite.isPending ? "Reescrevendo…" : "Gerar outro"}
            </Button>
            <SaveStatus state={autosave.state} className="self-center" />
          </>
        ) : (
          <Button disabled={write.isPending} onClick={() => write.mutate()}>
            <SparklesIcon />
            {write.isPending ? "Escrevendo…" : "Escrever e-mail"}
          </Button>
        )}
        <Button
          variant="ghost"
          className="ml-auto hover:bg-red/15 hover:text-red"
          disabled={busy}
          onClick={() => onUpdate({ status: "discarded" })}
        >
          Descartar
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Leads with an e-mail thread: the latest messages and a way into Conversas. */
function ConversationStep({ lead }: StepProps) {
  const { data } = useQuery(conversationQuery(lead.id));
  const last = data?.messages.slice(-2) ?? [];
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
      </CardHeader>
      <CardContent className="grid gap-3">
        {last.map((message) => (
          <div
            key={message.id}
            className={
              message.direction === "out"
                ? "rounded-lg border px-3 py-2 text-sm"
                : "rounded-lg bg-muted px-3 py-2 text-sm"
            }
          >
            <p className="mb-1 text-xs text-muted-foreground">
              {message.direction === "in" ? "Empresa" : message.author === "ai" ? "IA" : "Você"}
            </p>
            <p className="line-clamp-4 whitespace-pre-line wrap-break-word">{message.body}</p>
          </div>
        ))}
      </CardContent>
      <CardFooter>
        <Button asChild>
          <Link to="/conversas" search={{ lead: lead.id }}>
            Abrir conversa
          </Link>
        </Button>
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
      <Section title="Análise" tone="purple">
        <p className="text-sm font-light text-muted-foreground">
          {lead.analysisStatus === "error"
            ? `A análise falhou: ${lead.analysisError ?? "erro desconhecido"}. Tente reanalisar.`
            : lead.analysisStatus === "skipped"
              ? `${lead.analysisError ?? "Este lead ainda não foi analisado."} Use Reanalisar para analisar agora.`
              : "Lendo o site e avaliando. Esta tela atualiza sozinha."}
        </p>
      </Section>
    );
  }
  const hasLists = analysis.signals.length > 0 || analysis.painPoints.length > 0;
  return (
    <Section title="Análise" tone="purple">
      <div className="grouped grid gap-4 px-4 py-3.5">
        <p className="text-base leading-relaxed">{analysis.summary}</p>
        {hasLists ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <PlainList title="Oportunidades" tone="green" items={analysis.signals} />
            <PlainList title="Dores prováveis" tone="orange" items={analysis.painPoints} />
          </div>
        ) : status && !status.offerConfigured ? (
          <p className="text-sm font-light text-muted-foreground">
            Para ver oportunidades,{" "}
            <Link to="/settings" className="text-foreground underline underline-offset-4">
              descreva o que você vende
            </Link>{" "}
            e reanalise.
          </p>
        ) : (
          <p className="text-sm font-light text-muted-foreground">
            Nenhuma oportunidade clara para a sua oferta.
          </p>
        )}
        <details className="group/details text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-3.5 transition-transform duration-300 ease-spring group-open/details:rotate-90" />
            Como a nota foi calculada
          </summary>
          <p className="mt-2 leading-relaxed font-light text-muted-foreground">
            {analysis.scoreReasoning}
          </p>
        </details>
      </div>
    </Section>
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
    <Section title="Contato">
      <dl className="grouped grid text-sm">
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
            <span className="block text-xs font-light wrap-break-word text-muted-foreground">
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
    </Section>
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
    <Section
      title="Notas"
      status={
        <span aria-live="polite" className="text-xs font-light text-tertiary">
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
        className="min-h-28 bg-card! shadow-[inset_0_1px_0_rgb(255_255_255/0.045)] hover:shadow-[inset_0_0_0_1px_var(--input)]"
      />
    </Section>
  );
}

function Footer({
  lead,
  analysis,
  busy,
  onStatus,
  onChanged,
}: {
  lead: Lead;
  analysis: Analysis | null;
  busy: boolean;
  onStatus: (status: LeadStatus) => void;
  onChanged: () => Promise<unknown>;
}) {
  const analyzing = lead.analysisStatus === "pending";
  const reanalyze = useMutation({
    mutationFn: () => reanalyzeLead({ data: { id: lead.id } }),
    onSuccess: onChanged,
    onError: errorToast("Não foi possível iniciar a nova análise"),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        Status
        <Select
          value={lead.status}
          disabled={busy}
          onValueChange={(next) => {
            const status = LEAD_STATUS_VALUES.find((item) => item === next);
            if (status) onStatus(status);
          }}
        >
          <SelectTrigger size="sm" className="w-36" aria-label="Status do lead">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STATUS_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {LEAD_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {analysis ? (
          <span className="text-[11.5px] font-light text-tertiary">
            {analysis.model} · US$ {analysis.costEstimate.toFixed(4)} ·{" "}
            {formatDate(analysis.createdAt, true)}
          </span>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          onClick={() => reanalyze.mutate()}
          disabled={reanalyze.isPending || analyzing}
        >
          <RefreshCwIcon className={cn(analyzing && "animate-spin")} />
          {analyzing ? "Analisando…" : "Reanalisar"}
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  status,
  children,
}: {
  title: string;
  tone?: Tone;
  /** Quiet feedback after the title, e.g. "Salvo". */
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <h3
        className={cn(
          "mb-2 flex items-center gap-1.5 px-1 text-lg font-medium tracking-[-0.015em]",
          tone && TONE_TEXT[tone],
        )}
      >
        {tone === "purple" ? <SparklesIcon className="size-4" /> : null}
        {title}
        {status}
      </h3>
      {children}
    </section>
  );
}

function PlainList({ title, tone, items }: { title: string; tone: Tone; items: string[] }) {
  return (
    <div>
      <h4 className={cn("mb-1.5 text-xs font-medium", TONE_TEXT[tone])}>{title}</h4>
      {items.length > 0 ? (
        <ul className="grid gap-1.5 text-sm leading-relaxed font-light text-muted-foreground">
          {items.map((item) => (
            <li key={item} className="relative pl-3.5">
              <span
                aria-hidden
                className={cn(
                  "absolute top-[7px] left-0 size-1.5 rounded-full bg-current",
                  TONE_TEXT[tone],
                )}
              />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm font-light text-muted-foreground">Nenhuma.</p>
      )}
    </div>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grouped-row grid grid-cols-[84px_minmax(0,1fr)] items-baseline gap-3 px-4 py-2.5 [--inset:16px]">
      <dt className="font-light text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </div>
  );
}

/** Contacts-style action: a round colored tile with the label under it. */
function QuickAction(
  props: { icon: typeof PhoneIcon; tone: Tone; children: ReactNode } & (
    | ({ as?: undefined; external?: boolean } & React.ComponentProps<"a">)
    | ({ as: "button" } & React.ComponentProps<"button">)
  ),
) {
  const className = cn(
    "press grid min-w-[84px] flex-1 justify-items-center gap-1.5 rounded-[14px] bg-fill-3 px-2 py-2.5 text-[11.5px] font-medium whitespace-nowrap transition-colors hover:bg-fill-2",
    TONE_TEXT[props.tone],
  );
  const body = (
    <>
      <IconTile icon={props.icon} tone={props.tone} size={34} round />
      {props.children}
    </>
  );
  if (props.as === "button") {
    const { icon: _icon, tone: _tone, children: _children, as: _as, ...rest } = props;
    return (
      <button type="button" className={className} {...rest}>
        {body}
      </button>
    );
  }
  const { icon: _icon, tone: _tone, children, as: _as, external, ...rest } = props;
  if (external) {
    return (
      <ExternalLink className={className} indicator={false} {...rest}>
        <IconTile icon={props.icon} tone={props.tone} size={34} round />
        <span className="inline-flex items-center gap-0.5">
          {children}
          <ExternalMark />
        </span>
      </ExternalLink>
    );
  }
  return (
    <a className={className} {...rest}>
      {body}
    </a>
  );
}

/** Score inside a large ring, colored by tier. */
function ScoreRingLarge({ score, pending }: { score: number | null; pending: boolean }) {
  if (score === null) {
    return pending ? (
      <Badge variant="purple">
        <SparklesIcon />
        analisando
      </Badge>
    ) : (
      <Badge variant="gray">sem nota</Badge>
    );
  }
  const tier = scoreTier(score);
  const tone = TIER_TONE[tier];
  return (
    <ProgressRing value={score} tone={tone} size={60} thickness={5} track="var(--popover)">
      <span className={cn("grid justify-items-center leading-none", TONE_TEXT[tone])}>
        <b className="text-lg font-medium tabular-nums">{score}</b>
        <small className="text-[11px] font-medium">{SCORE_TIERS[tier].label}</small>
      </span>
    </ProgressRing>
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

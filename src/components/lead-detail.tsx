import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TIER_TEXT } from "@/components/lead-badges";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Analysis, Lead, LeadStatus, SiteStatus } from "@/db/schema";
import { addDays, formatDate, localDay, relativeDay } from "@/lib/format";
import { whatsappLink } from "@/lib/phone";
import { leadQuery, providerStatusQuery } from "@/lib/queries";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  SCORE_TIERS,
  scoreTier,
  type UpdateLeadInput,
} from "@/lib/schemas";
import { useToday } from "@/lib/today";
import { cn } from "@/lib/utils";
import { generateMessage, reanalyzeLead, updateFirstMessage, updateLead } from "@/server/leads";

const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  pending: "ainda não lido",
  none: "",
  ok: "lido",
  unreachable: "fora do ar",
  blocked: "bloqueado pelo robots.txt",
};

const FOLLOW_UP_OPTIONS = [
  { days: 1, label: "amanhã" },
  { days: 3, label: "em 3 dias" },
  { days: 7, label: "em 1 semana" },
  { days: 14, label: "em 2 semanas" },
] as const;

type LeadUpdate = Omit<UpdateLeadInput, "id">;

/**
 * Everything about one lead, organized around the next thing to do with it.
 * `toolbar` sits above the header (pager or back link); `onStatusChanged` lets the
 * inbox move on once the lead leaves the current queue.
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
  const { data } = useQuery(leadQuery(leadId));
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
  const refreshAll = () =>
    Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["leads"] })]);

  const update = useMutation({
    mutationFn: (changes: LeadUpdate) => updateLead({ data: { id: leadId, ...changes } }),
    onSuccess: async (_result, changes) => {
      await refreshAll();
      if (changes.status) onStatusChanged?.(changes.status);
    },
    onError: () => toast.error("Não foi possível atualizar o lead"),
  });
  const save = (changes: LeadUpdate) => update.mutate(changes);
  const today = useToday();

  if (!data) return <DetailSkeleton toolbar={toolbar} />;
  const { lead, analysis, search } = data;

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-4 pt-4 pb-16 sm:px-8 sm:pt-6">
      {toolbar}
      <Header lead={lead} search={search} />
      <QuickActions lead={lead} />
      <NextStep
        lead={lead}
        analysis={analysis}
        today={today}
        busy={update.isPending}
        onUpdate={save}
        onMessageChanged={refresh}
      />
      <AnalysisSection lead={lead} analysis={analysis} />
      <div className="grid gap-8 sm:grid-cols-2">
        <ContactSection lead={lead} />
        <NotesSection key={lead.id} lead={lead} onSave={(notes) => save({ notes })} />
      </div>
      <Footer
        lead={lead}
        analysis={analysis}
        busy={update.isPending}
        onStatus={(status) => save({ status })}
        onChanged={refreshAll}
      />
    </div>
  );
}

function Header({ lead, search }: { lead: Lead; search: { niche: string; city: string } | null }) {
  const tier = lead.score !== null ? scoreTier(lead.score) : null;
  const facts = [
    search ? `${search.niche}, ${search.city}` : lead.city,
    lead.rating !== null
      ? `${lead.rating.toFixed(1).replace(".", ",")} no Google (${lead.reviewCount ?? 0})`
      : "sem avaliações no Google",
  ].filter(Boolean);

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <h1 className="text-xl leading-snug font-medium tracking-tight sm:text-2xl">{lead.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{facts.join(" · ")}</p>
      </div>
      <div className="shrink-0 text-right">
        {lead.score !== null && tier ? (
          <>
            <p className={cn("text-3xl leading-none font-semibold tabular-nums", TIER_TEXT[tier])}>
              {lead.score}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              nota {SCORE_TIERS[tier].label.toLowerCase()}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {lead.analysisStatus === "error" ? "análise falhou" : "analisando…"}
          </p>
        )}
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
  const external = { target: "_blank", rel: "noreferrer" } as const;
  return (
    <div className="-mt-2 flex flex-wrap gap-2">
      {lead.phoneE164 ? (
        <>
          <Button asChild variant="outline" size="sm">
            <a href={whatsappLink(lead.phoneE164)} {...external}>
              WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${lead.phoneE164}`}>Ligar</a>
          </Button>
        </>
      ) : null}
      {lead.phone ? (
        <Button variant="outline" size="sm" onClick={() => void copyPhone()}>
          Copiar telefone
        </Button>
      ) : null}
      {lead.website ? (
        <Button asChild variant="outline" size="sm">
          <a href={lead.website} {...external}>
            Site
          </a>
        </Button>
      ) : null}
      {lead.mapsUrl ? (
        <Button asChild variant="outline" size="sm">
          <a href={lead.mapsUrl} {...external}>
            Google Maps
          </a>
        </Button>
      ) : null}
    </div>
  );
}

function NextStep({
  lead,
  analysis,
  today,
  busy,
  onUpdate,
  onMessageChanged,
}: {
  lead: Lead;
  analysis: Analysis | null;
  today: string;
  busy: boolean;
  onUpdate: (changes: LeadUpdate) => void;
  onMessageChanged: () => Promise<unknown>;
}) {
  switch (lead.status) {
    case "new":
      return (
        <FirstContactStep
          key={`${analysis?.id ?? "none"}:${analysis?.firstMessage ?? ""}`}
          lead={lead}
          analysis={analysis}
          today={today}
          busy={busy}
          onUpdate={onUpdate}
          onMessageChanged={onMessageChanged}
        />
      );
    case "contacted":
    case "replied": {
      const waiting = lead.status === "contacted";
      return (
        <StepCard title={waiting ? "Aguardando resposta" : "Em conversa"}>
          <p className="text-sm text-muted-foreground">
            {lead.contactedAt
              ? `Primeiro contato ${relativeDay(localDay(lead.contactedAt), today)}. `
              : ""}
            {waiting
              ? "Se não responder, mande um lembrete curto no dia do retorno."
              : "Anote nas notas o que foi combinado."}
          </p>
          <FollowUpPicker
            label={waiting ? "Retornar" : "Próximo contato"}
            value={lead.followUpOn}
            today={today}
            disabled={busy}
            onChange={(followUpOn) => onUpdate({ followUpOn })}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={busy}
              onClick={() => onUpdate({ status: waiting ? "replied" : "closed" })}
            >
              {waiting ? "Respondeu" : "Fechou negócio"}
            </Button>
            {lead.phoneE164 ? (
              <Button asChild variant="outline">
                <a href={whatsappLink(lead.phoneE164)} target="_blank" rel="noreferrer">
                  Abrir conversa
                </a>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="ml-auto text-muted-foreground"
              disabled={busy}
              onClick={() => onUpdate({ status: "discarded" })}
            >
              {waiting ? "Sem interesse" : "Não fechou"}
            </Button>
          </div>
          {analysis?.firstMessage ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Mensagem enviada
              </summary>
              <p className="mt-2 whitespace-pre-line text-muted-foreground">
                {analysis.firstMessage}
              </p>
            </details>
          ) : null}
        </StepCard>
      );
    }
    case "closed":
      return (
        <StepCard title="Negócio fechado">
          <div>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onUpdate({ status: "replied" })}
            >
              Reabrir conversa
            </Button>
          </div>
        </StepCard>
      );
    default:
      return (
        <StepCard title="Descartado">
          <div>
            <Button variant="outline" disabled={busy} onClick={() => onUpdate({ status: "new" })}>
              Voltar para a fila
            </Button>
          </div>
        </StepCard>
      );
  }
}

function FirstContactStep({
  lead,
  analysis,
  today,
  busy,
  onUpdate,
  onMessageChanged,
}: {
  lead: Lead;
  analysis: Analysis | null;
  today: string;
  busy: boolean;
  onUpdate: (changes: LeadUpdate) => void;
  onMessageChanged: () => Promise<unknown>;
}) {
  const [message, setMessage] = useState(analysis?.firstMessage ?? "");
  const [opened, setOpened] = useState(false);
  const [followUpDays, setFollowUpDays] = useState("3");
  const saved = analysis?.firstMessage ?? "";
  const hasMessage = message.trim().length > 0;
  const dirty = message !== saved && analysis !== null;

  const saveMessage = useMutation({
    mutationFn: () =>
      updateFirstMessage({ data: { analysisId: analysis?.id ?? "", firstMessage: message } }),
    onSuccess: onMessageChanged,
    onError: () => toast.error("Não foi possível salvar a mensagem"),
  });
  const generate = useMutation({
    mutationFn: () => generateMessage({ data: { id: lead.id } }),
    onSuccess: onMessageChanged,
    onError: (error) => toast.error(error.message || "Não foi possível gerar a mensagem"),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <StepCard
      title="Primeira mensagem"
      action={
        analysis && hasMessage ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? "Escrevendo…" : "Gerar outra"}
          </Button>
        ) : null
      }
    >
      <Textarea
        aria-label="Mensagem de primeiro contato"
        rows={5}
        placeholder={
          analysis
            ? "A nota ficou abaixo do limite das configurações, então a mensagem não foi escrita. Gere uma ou escreva a sua."
            : "Disponível depois da análise."
        }
        className="min-h-32 resize-y bg-background px-3.5 py-3 text-[16px] leading-relaxed"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        disabled={!analysis || generate.isPending}
      />
      <div className="flex flex-wrap items-center gap-2">
        {analysis && !hasMessage ? (
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? "Escrevendo…" : "Gerar mensagem"}
          </Button>
        ) : null}
        {lead.phoneE164 && hasMessage ? (
          <Button asChild variant={opened ? "outline" : "default"}>
            <a
              href={whatsappLink(lead.phoneE164, message)}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                if (dirty) saveMessage.mutate();
                setOpened(true);
              }}
            >
              Enviar pelo WhatsApp
            </a>
          </Button>
        ) : null}
        {hasMessage ? (
          <Button variant="outline" onClick={() => void copy()}>
            Copiar
          </Button>
        ) : null}
        {dirty ? (
          <Button
            variant="ghost"
            onClick={() => saveMessage.mutate()}
            disabled={saveMessage.isPending}
          >
            Salvar edição
          </Button>
        ) : null}
        {!lead.phoneE164 ? (
          <span className="text-sm text-muted-foreground">Sem WhatsApp: use o telefone.</span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4">
        <Button
          variant={opened ? "default" : "outline"}
          disabled={busy}
          onClick={() =>
            onUpdate({ status: "contacted", followUpOn: addDays(today, Number(followUpDays)) })
          }
        >
          Marcar como contatado
        </Button>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          retornar
          <Select value={followUpDays} onValueChange={setFollowUpDays}>
            <SelectTrigger className="h-9 w-36" aria-label="Retornar em">
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
        </span>
        <Button
          variant="ghost"
          className="ml-auto text-muted-foreground"
          disabled={busy}
          onClick={() => onUpdate({ status: "discarded" })}
        >
          Descartar
        </Button>
      </div>
    </StepCard>
  );
}

function FollowUpPicker({
  label,
  value,
  today,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  today: string;
  disabled: boolean;
  onChange: (day: string | null) => void;
}) {
  const overdue = value !== null && value < today;
  return (
    <div className="grid gap-2">
      <p className="text-sm">
        {label}:{" "}
        {value ? (
          <span className={cn("font-medium", overdue || value === today ? "text-brand" : "")}>
            {relativeDay(value, today)}
            {overdue ? " (atrasado)" : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">sem data</span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {FOLLOW_UP_OPTIONS.slice(0, 3).map((option) => (
          <Button
            key={option.days}
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(addDays(today, option.days))}
          >
            {option.label}
          </Button>
        ))}
        <input
          type="date"
          aria-label="Escolher data"
          value={value ?? ""}
          min={today}
          disabled={disabled}
          onChange={(event) => event.target.value && onChange(event.target.value)}
          className="h-7 rounded-md border bg-background px-2 text-sm text-muted-foreground"
        />
        {value ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            remover
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AnalysisSection({ lead, analysis }: { lead: Lead; analysis: Analysis | null }) {
  const { data: status } = useQuery(providerStatusQuery);
  if (!analysis) {
    return (
      <Section title="Análise">
        <p className="text-sm text-muted-foreground">
          {lead.analysisStatus === "error"
            ? `A análise falhou: ${lead.analysisError ?? "erro desconhecido"}. Tente reanalisar.`
            : "Lendo o site e avaliando. Esta tela atualiza sozinha."}
        </p>
      </Section>
    );
  }
  const hasLists = analysis.signals.length > 0 || analysis.painPoints.length > 0;
  return (
    <Section title="Análise">
      <p className="text-[16px] leading-relaxed">{analysis.summary}</p>
      {hasLists ? (
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <PlainList title="Oportunidades" items={analysis.signals} />
          <PlainList title="Dores prováveis" items={analysis.painPoints} />
        </div>
      ) : status && !status.offerConfigured ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Para ver oportunidades,{" "}
          <Link to="/settings" className="text-foreground underline underline-offset-4">
            descreva o que você vende
          </Link>{" "}
          e reanalise.
        </p>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Nenhuma oportunidade clara para a sua oferta.
        </p>
      )}
      <details className="mt-5 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Como a nota foi calculada
        </summary>
        <p className="mt-2 leading-relaxed text-muted-foreground">{analysis.scoreReasoning}</p>
      </details>
    </Section>
  );
}

function ContactSection({ lead }: { lead: Lead }) {
  const site = lead.siteData;
  return (
    <Section title="Contato">
      <dl className="grid gap-3 text-sm">
        <Term label="Telefone">
          <span className="tabular-nums">{lead.phone ?? "Sem telefone"}</span>
        </Term>
        <Term label="Site">
          {lead.website ? (
            <>
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                className="break-all underline-offset-4 hover:underline"
              >
                {lead.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
              {SITE_STATUS_LABELS[lead.siteStatus] ? (
                <span className="text-muted-foreground">
                  {" "}
                  · {SITE_STATUS_LABELS[lead.siteStatus]}
                </span>
              ) : null}
            </>
          ) : (
            "Sem site"
          )}
        </Term>
        {site && site.emails.length > 0 ? (
          <Term label="E-mail">{site.emails.join(", ")}</Term>
        ) : null}
        {site && site.socialLinks.length > 0 ? (
          <Term label="Redes">
            {site.socialLinks.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noreferrer"
                className="block truncate underline-offset-4 hover:underline"
              >
                {link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            ))}
          </Term>
        ) : null}
        <Term label="Endereço">{lead.address ?? "Sem endereço"}</Term>
      </dl>
    </Section>
  );
}

/** Saves when the field loses focus, so there is no button to remember. */
function NotesSection({ lead, onSave }: { lead: Lead; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(lead.notes);
  return (
    <Section
      title="Notas"
      action={
        notes !== lead.notes ? (
          <span className="text-xs text-muted-foreground">salva ao sair do campo</span>
        ) : null
      }
    >
      <Textarea
        aria-label="Notas"
        rows={5}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        onBlur={() => notes !== lead.notes && onSave(notes)}
        placeholder="Ex.: falei com a recepção, retornar na segunda."
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
    onError: () => toast.error("Não foi possível iniciar a nova análise"),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-5 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Status</span>
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
      <p className="flex flex-wrap items-center gap-x-2">
        {analysis ? (
          <span>
            {analysis.model} · US$ {analysis.costEstimate.toFixed(4)} ·{" "}
            {formatDate(analysis.createdAt, true)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => reanalyze.mutate()}
          disabled={reanalyze.isPending || analyzing}
          className="text-foreground underline-offset-4 hover:underline disabled:text-muted-foreground disabled:no-underline"
        >
          {analyzing ? "Analisando…" : "Reanalisar"}
        </button>
      </p>
    </div>
  );
}

function StepCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:p-5">
      <div className="flex min-h-8 items-center justify-between gap-4">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex min-h-6 items-center justify-between gap-4">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function PlainList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
      {items.length > 0 ? (
        <ul className="grid list-disc gap-1.5 pl-4 text-sm leading-relaxed marker:text-muted-foreground/60">
          {items.map((item) => (
            <li key={item}>{item}</li>
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
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function DetailSkeleton({ toolbar }: { toolbar?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 pt-4 sm:px-8 sm:pt-6">
      {toolbar}
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

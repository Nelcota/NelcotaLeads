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
import { formatDate } from "@/lib/format";
import { whatsappLink } from "@/lib/phone";
import { leadQuery, providerStatusQuery } from "@/lib/queries";
import { LEAD_STATUS_LABELS, LEAD_STATUS_VALUES, scoreTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { generateMessage, reanalyzeLead, updateFirstMessage, updateLead } from "@/server/leads";

const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  pending: "Ainda não lido",
  none: "Sem site",
  ok: "Lido",
  unreachable: "Fora do ar",
  blocked: "Bloqueado pelo robots.txt",
};

/** Full lead view; `compact` stacks everything in one column for the side panel. */
export function LeadDetail({ leadId, compact = false }: { leadId: string; compact?: boolean }) {
  const { data } = useQuery(leadQuery(leadId));
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
  const refreshAll = () =>
    Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["leads"] })]);

  // Lives here, not in the composer: saving the message remounts the composer.
  const [opened, setOpened] = useState(false);
  const setStatus = useMutation({
    mutationFn: (status: LeadStatus) => updateLead({ data: { id: leadId, status } }),
    onSuccess: refreshAll,
    onError: () => toast.error("Não foi possível atualizar o status"),
  });

  if (!data) return <DetailSkeleton />;
  const { lead, analysis, search } = data;

  return (
    <div className="grid gap-10">
      <div className="grid gap-5">
        <Header lead={lead} search={search} onChanged={refreshAll} />
        <StatusSelect
          value={lead.status}
          disabled={setStatus.isPending}
          onChange={(status) => setStatus.mutate(status)}
        />
      </div>
      <div className={cn("grid gap-10", !compact && "lg:grid-cols-[minmax(0,1fr)_280px]")}>
        <div className="grid min-w-0 content-start gap-10">
          <MessageComposer
            key={`${analysis?.id ?? "none"}:${analysis?.firstMessage ?? ""}`}
            lead={lead}
            analysis={analysis}
            onChanged={refresh}
            opened={opened}
            onOpened={() => setOpened(true)}
            onMarkContacted={() => setStatus.mutate("contacted")}
          />
          <AnalysisSection lead={lead} analysis={analysis} />
        </div>
        <div className="grid content-start gap-10">
          <ContactSection lead={lead} />
          <NotesSection key={lead.id} lead={lead} onSaved={refreshAll} />
        </div>
      </div>
    </div>
  );
}

function Header({
  lead,
  search,
  onChanged,
}: {
  lead: Lead;
  search: { niche: string; city: string } | null;
  onChanged: () => Promise<unknown>;
}) {
  const analyzing = lead.analysisStatus === "pending";
  const reanalyze = useMutation({
    mutationFn: () => reanalyzeLead({ data: { id: lead.id } }),
    onSuccess: onChanged,
    onError: () => toast.error("Não foi possível iniciar a nova análise"),
  });

  return (
    <div className="flex items-start justify-between gap-6 pr-8">
      <div className="min-w-0">
        <h1 className="text-lg leading-snug font-medium tracking-tight sm:text-xl">{lead.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {search ? `${search.niche}, ${search.city}` : lead.city} · coletado em{" "}
          {formatDate(lead.createdAt)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {lead.score !== null ? (
          <p className="leading-none">
            <span
              className={cn(
                "text-2xl font-semibold tabular-nums",
                TIER_TEXT[scoreTier(lead.score)],
              )}
            >
              {lead.score}
            </span>
            <span className="text-sm text-muted-foreground">/100</span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => reanalyze.mutate()}
          disabled={reanalyze.isPending || analyzing}
          className="mt-2 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:no-underline disabled:opacity-60"
        >
          {analyzing ? "Analisando…" : "Reanalisar"}
        </button>
      </div>
    </div>
  );
}

function StatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: LeadStatus;
  disabled: boolean;
  onChange: (status: LeadStatus) => void;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">Status</span>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          const status = LEAD_STATUS_VALUES.find((item) => item === next);
          if (status) onChange(status);
        }}
      >
        <SelectTrigger className="h-9 w-44" aria-label="Status do lead">
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
  );
}

function MessageComposer({
  lead,
  analysis,
  onChanged,
  opened,
  onOpened,
  onMarkContacted,
}: {
  lead: Lead;
  analysis: Analysis | null;
  onChanged: () => Promise<unknown>;
  opened: boolean;
  onOpened: () => void;
  onMarkContacted: () => void;
}) {
  const [message, setMessage] = useState(analysis?.firstMessage ?? "");
  const saved = analysis?.firstMessage ?? "";
  const hasMessage = message.trim().length > 0;
  const dirty = message !== saved && analysis !== null;

  const save = useMutation({
    mutationFn: () =>
      updateFirstMessage({ data: { analysisId: analysis?.id ?? "", firstMessage: message } }),
    onSuccess: onChanged,
    onError: () => toast.error("Não foi possível salvar a mensagem"),
  });
  const generate = useMutation({
    mutationFn: () => generateMessage({ data: { id: lead.id } }),
    onSuccess: onChanged,
    onError: (error) => toast.error(error.message || "Não foi possível gerar a mensagem"),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast.success("Copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const generateLabel = generate.isPending
    ? "Escrevendo…"
    : hasMessage
      ? "Gerar outra"
      : "Gerar mensagem";

  return (
    <Section
      title="Mensagem"
      action={
        analysis && hasMessage ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generateLabel}
          </Button>
        ) : null
      }
    >
      <Textarea
        aria-label="Mensagem de primeiro contato"
        rows={6}
        placeholder={
          analysis
            ? "A nota ficou abaixo do limite das configurações, então a mensagem não foi escrita. Gere uma ou escreva a sua."
            : "Disponível depois da análise."
        }
        className="min-h-36 resize-y px-3.5 py-3 text-[16px] leading-relaxed"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        disabled={!analysis || generate.isPending}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {analysis && !hasMessage ? (
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generateLabel}
          </Button>
        ) : null}
        {!lead.phoneE164 ? (
          <Button variant="outline" disabled title="O lead não tem um telefone válido">
            Sem WhatsApp
          </Button>
        ) : hasMessage ? (
          <Button asChild>
            <a
              href={whatsappLink(lead.phoneE164, message)}
              target="_blank"
              rel="noreferrer"
              onClick={() => {
                if (dirty) save.mutate();
                onOpened();
              }}
            >
              Abrir no WhatsApp
            </a>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Abrir no WhatsApp
          </Button>
        )}
        {hasMessage ? (
          <Button variant="outline" onClick={() => void copy()}>
            Copiar
          </Button>
        ) : null}
        {dirty ? (
          <Button variant="ghost" onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar edição
          </Button>
        ) : null}
      </div>
      {opened && lead.status === "new" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Enviou a mensagem?{" "}
          <button
            type="button"
            onClick={onMarkContacted}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Marcar como contatado
          </button>
        </p>
      ) : null}
    </Section>
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
            : "Em análise. Esta tela atualiza sozinha."}
        </p>
      </Section>
    );
  }
  return (
    <Section title="Análise">
      <p className="text-[16px] leading-relaxed">{analysis.summary}</p>
      {analysis.signals.length > 0 || analysis.painPoints.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <PlainList title="Oportunidades" items={analysis.signals} />
          <PlainList title="Dores prováveis" items={analysis.painPoints} />
        </div>
      ) : status && !status.offerConfigured ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Para ver oportunidades,{" "}
          <Link to="/settings" className="text-foreground underline underline-offset-4">
            descreva o que você vende
          </Link>{" "}
          e reanalise.
        </p>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          Nenhuma oportunidade clara para a sua oferta.
        </p>
      )}
      <details className="mt-6 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Como a nota foi calculada
        </summary>
        <p className="mt-2 leading-relaxed text-muted-foreground">{analysis.scoreReasoning}</p>
      </details>
      <p className="mt-4 text-xs text-muted-foreground">
        {analysis.model} · {(analysis.tokensIn + analysis.tokensOut).toLocaleString("pt-BR")} tokens
        · US$ {analysis.costEstimate.toFixed(4)} · {formatDate(analysis.createdAt, true)}
      </p>
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
              <span className="text-muted-foreground">
                {" "}
                · {SITE_STATUS_LABELS[lead.siteStatus]}
              </span>
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
        <Term label="Google">
          {lead.rating !== null
            ? `${lead.rating.toFixed(1).replace(".", ",")} · ${lead.reviewCount ?? 0} ${lead.reviewCount === 1 ? "avaliação" : "avaliações"}`
            : "Sem avaliações"}
        </Term>
        <Term label="Endereço">
          {lead.mapsUrl ? (
            <a
              href={lead.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {lead.address ?? "Ver no mapa"}
            </a>
          ) : (
            (lead.address ?? "Sem endereço")
          )}
        </Term>
      </dl>
    </Section>
  );
}

function NotesSection({ lead, onSaved }: { lead: Lead; onSaved: () => Promise<unknown> }) {
  const [notes, setNotes] = useState(lead.notes);
  const save = useMutation({
    mutationFn: () => updateLead({ data: { id: lead.id, notes } }),
    onSuccess: onSaved,
    onError: () => toast.error("Não foi possível salvar as notas"),
  });
  return (
    <Section title="Notas">
      <Textarea
        aria-label="Notas"
        rows={3}
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Ex.: falei com a recepção, retornar na segunda."
      />
      {notes !== lead.notes ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          Salvar notas
        </Button>
      ) : null}
    </Section>
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
      <div className="mb-3 flex min-h-8 items-center justify-between gap-4">
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

function DetailSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function LeadPageLink({ leadId }: { leadId: string }) {
  return (
    <Link
      to="/leads/$leadId"
      params={{ leadId }}
      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      Abrir em página inteira
    </Link>
  );
}

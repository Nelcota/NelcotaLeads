import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TIER_TEXT } from "@/components/lead-badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Analysis, Lead, LeadStatus, SiteStatus } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { whatsappLink } from "@/lib/phone";
import { leadQuery } from "@/lib/queries";
import { LEAD_STATUS_LABELS, scoreTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { generateMessage, reanalyzeLead, updateFirstMessage, updateLead } from "@/server/leads";

const PIPELINE: LeadStatus[] = ["new", "contacted", "replied", "closed"];

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

  if (!data) return <DetailSkeleton />;
  const { lead, analysis, search } = data;

  return (
    <div className="grid gap-10">
      <div className="grid gap-6">
        <Header lead={lead} search={search} onChanged={refreshAll} />
        <StatusPipeline lead={lead} onChanged={refreshAll} />
      </div>
      <div className={cn("grid gap-10", !compact && "lg:grid-cols-[minmax(0,1fr)_280px]")}>
        <div className="grid min-w-0 content-start gap-10">
          <MessageComposer
            key={`${analysis?.id ?? "none"}:${analysis?.firstMessage ?? ""}`}
            lead={lead}
            analysis={analysis}
            onChanged={refresh}
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
        <h1 className="text-xl leading-snug font-medium tracking-tight sm:text-2xl">{lead.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {search ? `${search.niche}, ${search.city}` : lead.city} · coletado em{" "}
          {formatDate(lead.createdAt)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {lead.score !== null ? (
          <p className="leading-none">
            <span
              className={cn("text-3xl font-medium tabular-nums", TIER_TEXT[scoreTier(lead.score)])}
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

function StatusPipeline({ lead, onChanged }: { lead: Lead; onChanged: () => Promise<unknown> }) {
  const mutation = useMutation({
    mutationFn: (status: LeadStatus) => updateLead({ data: { id: lead.id, status } }),
    onSuccess: onChanged,
    onError: () => toast.error("Não foi possível atualizar o status"),
  });
  const discarded = lead.status === "discarded";
  const current = PIPELINE.indexOf(lead.status);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <ol
        className={cn(
          "flex min-w-0 basis-full overflow-hidden rounded-lg border text-[13px] sm:flex-1 sm:basis-auto sm:text-sm",
          discarded && "opacity-50",
        )}
        aria-label="Etapa do contato"
      >
        {PIPELINE.map((status, index) => (
          <li key={status} className="min-w-0 flex-1 border-r last:border-r-0">
            <button
              type="button"
              aria-current={lead.status === status ? "step" : undefined}
              disabled={mutation.isPending || lead.status === status}
              onClick={() => mutation.mutate(status)}
              className={cn(
                "h-9 w-full px-1 whitespace-nowrap transition-colors sm:px-2",
                !discarded && index <= current
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
                lead.status === status && "cursor-default",
              )}
            >
              {LEAD_STATUS_LABELS[status]}
            </button>
          </li>
        ))}
      </ol>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 text-muted-foreground"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(discarded ? "new" : "discarded")}
      >
        {discarded ? "Restaurar" : "Descartar"}
      </Button>
    </div>
  );
}

function MessageComposer({
  lead,
  analysis,
  onChanged,
}: {
  lead: Lead;
  analysis: Analysis | null;
  onChanged: () => Promise<unknown>;
}) {
  const [message, setMessage] = useState(analysis?.firstMessage ?? "");
  const saved = analysis?.firstMessage ?? "";

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

  return (
    <Section
      title="Mensagem"
      action={
        analysis ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? "Escrevendo…" : saved ? "Gerar outra" : "Gerar mensagem"}
          </Button>
        ) : null
      }
    >
      <Textarea
        aria-label="Mensagem de primeiro contato"
        rows={6}
        placeholder={
          analysis
            ? "Nota abaixo do limite das configurações. Gere uma mensagem ou escreva a sua."
            : "Disponível depois da análise."
        }
        className="min-h-36 resize-y px-3.5 py-3 text-[15px] leading-relaxed"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        disabled={!analysis || generate.isPending}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {lead.phoneE164 ? (
          <Button asChild>
            <a href={whatsappLink(lead.phoneE164, message)} target="_blank" rel="noreferrer">
              Abrir no WhatsApp
            </a>
          </Button>
        ) : (
          <Button disabled title="O lead não tem um telefone válido">
            Sem WhatsApp
          </Button>
        )}
        <Button variant="outline" onClick={() => void copy()} disabled={!message}>
          Copiar
        </Button>
        {message !== saved && analysis ? (
          <Button variant="ghost" onClick={() => save.mutate()} disabled={save.isPending}>
            Salvar edição
          </Button>
        ) : null}
      </div>
    </Section>
  );
}

function AnalysisSection({ lead, analysis }: { lead: Lead; analysis: Analysis | null }) {
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
      <p className="text-[15px] leading-relaxed">{analysis.summary}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <PlainList title="Oportunidades" items={analysis.signals} />
        <PlainList title="Dores prováveis" items={analysis.painPoints} />
      </div>
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
        <h2 className="text-sm font-medium">{title}</h2>
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

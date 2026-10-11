import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArchiveRestoreIcon,
  ArchiveXIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  RefreshCwIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ScoreRing } from "@/components/lead-badges";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Analysis, Lead, LeadStatus, SiteStatus } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { whatsappLink } from "@/lib/phone";
import { leadQuery } from "@/lib/queries";
import { LEAD_STATUS_LABELS } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { generateMessage, reanalyzeLead, updateFirstMessage, updateLead } from "@/server/leads";

const PIPELINE: LeadStatus[] = ["new", "contacted", "replied", "closed"];

const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  pending: "Ainda não lido",
  none: "Sem site",
  ok: "Lido",
  unreachable: "Fora do ar",
  blocked: "Bloqueado (robots.txt)",
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
    <div className="grid gap-8">
      <Header lead={lead} search={search} onChanged={refreshAll} />
      <StatusPipeline lead={lead} onChanged={refreshAll} />
      <div className={cn("grid gap-8", !compact && "lg:grid-cols-[minmax(0,1fr)_300px]")}>
        <div className="grid min-w-0 content-start gap-8">
          <MessageComposer
            key={`${analysis?.id ?? "none"}:${analysis?.firstMessage ?? ""}`}
            lead={lead}
            analysis={analysis}
            onChanged={refresh}
          />
          <AnalysisSection lead={lead} analysis={analysis} />
        </div>
        <div className="grid content-start gap-8">
          <ContactSection lead={lead} />
          <SiteSection lead={lead} />
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
    onSuccess: async () => {
      toast.success("Nova análise na fila");
      await onChanged();
    },
    onError: () => toast.error("Não foi possível iniciar a nova análise"),
  });

  return (
    <div className="flex items-start gap-4 pr-8">
      {lead.score !== null ? (
        <ScoreRing score={lead.score} size={56} stroke={4} showValue className="text-lg" />
      ) : (
        <span className="grid size-14 shrink-0 place-items-center rounded-full border-4 border-muted text-xs text-muted-foreground">
          {analyzing ? "…" : "—"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl leading-snug font-medium tracking-tight sm:text-2xl">{lead.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {search ? `${search.niche} em ${search.city}` : lead.city} · coletado em{" "}
          {formatDate(lead.createdAt)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-muted-foreground"
        onClick={() => reanalyze.mutate()}
        disabled={reanalyze.isPending || analyzing}
        title="Ler o site e analisar de novo com a IA"
      >
        <RefreshCwIcon className={analyzing ? "animate-spin" : undefined} />
        <span className="hidden sm:inline">{analyzing ? "Analisando…" : "Reanalisar"}</span>
      </Button>
    </div>
  );
}

function StatusPipeline({ lead, onChanged }: { lead: Lead; onChanged: () => Promise<unknown> }) {
  const mutation = useMutation({
    mutationFn: (status: LeadStatus) => updateLead({ data: { id: lead.id, status } }),
    onSuccess: async (_r, status) => {
      toast.success(`Marcado como ${LEAD_STATUS_LABELS[status].toLowerCase()}`);
      await onChanged();
    },
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
        {PIPELINE.map((status, index) => {
          const done = !discarded && index <= current;
          return (
            <li key={status} className="min-w-0 flex-1 border-r last:border-r-0">
              <button
                type="button"
                aria-current={lead.status === status ? "step" : undefined}
                disabled={mutation.isPending || lead.status === status}
                onClick={() => mutation.mutate(status)}
                className={cn(
                  "flex h-9 w-full items-center justify-center gap-1 px-1 whitespace-nowrap transition-colors sm:gap-1.5 sm:px-2",
                  done ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
                  lead.status === status && "cursor-default",
                )}
              >
                {done && index < current ? <CheckIcon className="size-3.5" /> : null}
                {LEAD_STATUS_LABELS[status]}
              </button>
            </li>
          );
        })}
      </ol>
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate(discarded ? "new" : "discarded")}
      >
        {discarded ? <ArchiveRestoreIcon /> : <ArchiveXIcon />}
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
  const dirty = message !== saved;

  const save = useMutation({
    mutationFn: () =>
      updateFirstMessage({ data: { analysisId: analysis?.id ?? "", firstMessage: message } }),
    onSuccess: async () => {
      toast.success("Mensagem salva");
      await onChanged();
    },
    onError: () => toast.error("Não foi possível salvar a mensagem"),
  });
  const generate = useMutation({
    mutationFn: () => generateMessage({ data: { id: lead.id } }),
    onSuccess: async () => {
      toast.success("Mensagem gerada");
      await onChanged();
    },
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
    <Section
      title="Mensagem"
      action={
        analysis ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            <SparklesIcon className={generate.isPending ? "animate-pulse" : undefined} />
            {generate.isPending ? "Escrevendo…" : saved ? "Gerar outra" : "Gerar com IA"}
          </Button>
        ) : null
      }
    >
      <div className="overflow-hidden rounded-xl border bg-card focus-within:ring-3 focus-within:ring-ring/30">
        <Textarea
          aria-label="Mensagem de primeiro contato"
          rows={6}
          placeholder={
            analysis
              ? "A nota ficou abaixo do limite das Configurações. Gere com a IA ou escreva aqui."
              : "Disponível depois da análise."
          }
          className="min-h-36 resize-y rounded-none border-0 bg-transparent px-4 py-3 text-[15px] leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!analysis || generate.isPending}
        />
        <div className="flex flex-wrap items-center gap-2 border-t bg-muted/30 px-3 py-2.5">
          {lead.phoneE164 ? (
            <Button asChild size="sm">
              <a href={whatsappLink(lead.phoneE164, message)} target="_blank" rel="noreferrer">
                <MessageCircleIcon /> Abrir no WhatsApp
              </a>
            </Button>
          ) : (
            <Button size="sm" disabled title="O lead não tem um telefone válido">
              <MessageCircleIcon /> Sem WhatsApp
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void copy()} disabled={!message}>
            <CopyIcon /> Copiar
          </Button>
          {dirty && analysis ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              Salvar edição
            </Button>
          ) : null}
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {message.length} caracteres
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Nada é enviado automaticamente: o WhatsApp abre com o texto para você revisar e enviar.
      </p>
    </Section>
  );
}

function AnalysisSection({ lead, analysis }: { lead: Lead; analysis: Analysis | null }) {
  if (!analysis) {
    return (
      <Section title="Análise">
        <p className="text-sm text-muted-foreground">
          {lead.analysisStatus === "error"
            ? `A análise falhou: ${lead.analysisError ?? "erro desconhecido"}. Use “Reanalisar” para tentar de novo.`
            : "A IA está lendo o site e analisando esta empresa. Esta tela atualiza sozinha."}
        </p>
      </Section>
    );
  }
  return (
    <Section title="Análise">
      <p className="text-[15px] leading-relaxed">{analysis.summary}</p>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <BulletList title="Oportunidades" items={analysis.signals} tone="brand" />
        <BulletList title="Dores prováveis" items={analysis.painPoints} />
      </div>
      <details className="group mt-6 rounded-lg border px-4 py-3">
        <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">
          <span className="text-muted-foreground group-open:text-foreground">
            Por que nota {lead.score ?? analysis.score}?
          </span>
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {analysis.scoreReasoning}
        </p>
      </details>
      <p className="mt-4 text-xs text-muted-foreground">
        {analysis.model} · {(analysis.tokensIn + analysis.tokensOut).toLocaleString("pt-BR")} tokens
        · US$ {analysis.costEstimate.toFixed(4)} · {formatDate(analysis.createdAt, true)}
      </p>
    </Section>
  );
}

function ContactSection({ lead }: { lead: Lead }) {
  return (
    <Section title="Contato">
      <ul className="grid gap-3 text-sm">
        <InfoRow icon={PhoneIcon}>
          {lead.phone ? (
            <span className="tabular-nums">{lead.phone}</span>
          ) : (
            <span className="text-muted-foreground">Sem telefone</span>
          )}
        </InfoRow>
        <InfoRow icon={GlobeIcon}>
          {lead.website ? (
            <a
              href={lead.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
            >
              <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, "")}</span>
              <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
            </a>
          ) : (
            <span className="text-muted-foreground">Sem site</span>
          )}
        </InfoRow>
        <InfoRow icon={StarIcon}>
          {lead.rating !== null ? (
            <span className="tabular-nums">
              {lead.rating.toFixed(1)}{" "}
              <span className="text-muted-foreground">
                · {lead.reviewCount ?? 0} {lead.reviewCount === 1 ? "avaliação" : "avaliações"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem avaliações</span>
          )}
        </InfoRow>
        <InfoRow icon={MapPinIcon}>
          {lead.mapsUrl ? (
            <a
              href={lead.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {lead.address ?? "Ver no Google Maps"}
            </a>
          ) : (
            (lead.address ?? <span className="text-muted-foreground">Sem endereço</span>)
          )}
        </InfoRow>
      </ul>
    </Section>
  );
}

function SiteSection({ lead }: { lead: Lead }) {
  const site = lead.siteData;
  if (!lead.website) return null;
  return (
    <Section title="Site">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
        <Term label="Leitura">{SITE_STATUS_LABELS[lead.siteStatus]}</Term>
        {site ? (
          <>
            <Term label="HTTPS">{site.https ? "Sim" : "Não"}</Term>
            {site.copyrightYear ? <Term label="Rodapé">{site.copyrightYear}</Term> : null}
            <Term label="E-mails">
              {site.emails.length > 0 ? site.emails.join(", ") : "Nenhum"}
            </Term>
            <Term label="Redes">
              {site.socialLinks.length > 0 ? (
                <span className="grid gap-1">
                  {site.socialLinks.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate underline-offset-4 hover:underline"
                    >
                      {link.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                    </a>
                  ))}
                </span>
              ) : (
                "Nenhuma"
              )}
            </Term>
          </>
        ) : null}
      </dl>
    </Section>
  );
}

function NotesSection({ lead, onSaved }: { lead: Lead; onSaved: () => Promise<unknown> }) {
  const [notes, setNotes] = useState(lead.notes);
  const save = useMutation({
    mutationFn: () => updateLead({ data: { id: lead.id, notes } }),
    onSuccess: async () => {
      toast.success("Notas salvas");
      await onSaved();
    },
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

function BulletList({ title, items, tone }: { title: string; items: string[]; tone?: "brand" }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h3>
      {items.length > 0 ? (
        <ul className="grid gap-2 text-sm">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5 leading-relaxed">
              <span
                className={cn(
                  "mt-[7px] size-1.5 shrink-0 rounded-full",
                  tone === "brand" ? "bg-brand" : "bg-muted-foreground/50",
                )}
              />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhuma identificada.</p>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof PhoneIcon; children: ReactNode }) {
  return (
    <li className="flex min-w-0 gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 break-words">{children}</div>
    </li>
  );
}

function Term({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function LeadPageLink({ leadId }: { leadId: string }) {
  return (
    <Link
      to="/leads/$leadId"
      params={{ leadId }}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      Abrir em página inteira <ExternalLinkIcon className="size-3" />
    </Link>
  );
}

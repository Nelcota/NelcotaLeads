import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CopyIcon,
  ExternalLinkIcon,
  MapPinIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ScoreBadge } from "@/components/lead-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Analysis, Lead, SiteStatus } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { whatsappLink } from "@/lib/phone";
import { leadQuery } from "@/lib/queries";
import { LEAD_STATUS_LABELS, LEAD_STATUS_VALUES } from "@/lib/schemas";
import { generateMessage, reanalyzeLead, updateFirstMessage, updateLead } from "@/server/leads";

export const Route = createFileRoute("/leads/$leadId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(leadQuery(params.leadId)),
  component: LeadPage,
});

const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  pending: "Ainda não lido",
  none: "Sem site",
  ok: "Lido com sucesso",
  unreachable: "Fora do ar ou inacessível",
  blocked: "Bloqueado pelo robots.txt",
};

function LeadPage() {
  const { leadId } = Route.useParams();
  const { data } = useSuspenseQuery(leadQuery(leadId));
  const { lead, analysis, search } = data;
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] }),
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
    ]);

  const statusMutation = useMutation({
    mutationFn: (status: Lead["status"]) => updateLead({ data: { id: lead.id, status } }),
    onSuccess: async (_result, status) => {
      toast.success(`Status: ${LEAD_STATUS_LABELS[status]}`);
      await refresh();
    },
    onError: () => toast.error("Não foi possível atualizar o status"),
  });
  const reanalyzeMutation = useMutation({
    mutationFn: () => reanalyzeLead({ data: { id: lead.id } }),
    onSuccess: async () => {
      toast.success("Nova análise na fila");
      await refresh();
    },
    onError: () => toast.error("Não foi possível iniciar a nova análise"),
  });
  const analyzing = lead.analysisStatus === "pending";

  return (
    <>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Leads
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="flex min-w-0 items-start gap-4">
          {lead.score !== null ? (
            <ScoreBadge
              score={lead.score}
              className="h-12 min-w-12 items-center rounded-lg text-xl font-medium"
            />
          ) : null}
          <div className="min-w-0">
            <h1 className="text-2xl font-medium tracking-tight sm:text-[28px]">{lead.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? `${search.niche} em ${search.city} · ` : ""}
              coletado em {formatDate(lead.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={lead.status}
            onValueChange={(value) => {
              const status = LEAD_STATUS_VALUES.find((s) => s === value);
              if (status) statusMutation.mutate(status);
            }}
          >
            <SelectTrigger className="w-36" aria-label="Status do lead">
              <SelectValue>{LEAD_STATUS_LABELS[lead.status]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUS_VALUES.map((status) => (
                <SelectItem key={status} value={status}>
                  {LEAD_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => reanalyzeMutation.mutate()}
            disabled={reanalyzeMutation.isPending || analyzing}
          >
            <RefreshCwIcon className={analyzing ? "animate-spin" : undefined} />
            {analyzing ? "Analisando…" : "Reanalisar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid content-start gap-6">
          <AnalysisCard lead={lead} analysis={analysis} />
          <MessageCard
            key={`${analysis?.id ?? "none"}:${analysis?.firstMessage ?? ""}`}
            lead={lead}
            analysis={analysis}
          />
        </div>
        <div className="grid content-start gap-6">
          <GoogleCard lead={lead} />
          <SiteCard lead={lead} />
          <NotesCard key={lead.id} lead={lead} onSaved={refresh} />
        </div>
      </div>
    </>
  );
}

function AnalysisCard({ lead, analysis }: { lead: Lead; analysis: Analysis | null }) {
  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análise</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {lead.analysisStatus === "error"
            ? `A análise falhou: ${lead.analysisError ?? "erro desconhecido"}. Use “Reanalisar” para tentar de novo.`
            : "A IA está lendo o site e analisando este lead. A página atualiza sozinha."}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-7 text-sm">
        <p className="text-[15px] leading-relaxed">{analysis.summary}</p>
        <div className="grid gap-7 sm:grid-cols-2">
          <BulletList title="Sinais de oportunidade" items={analysis.signals} />
          <BulletList title="Dores prováveis" items={analysis.painPoints} />
        </div>
        <div>
          <SectionLabel>Por que esta nota</SectionLabel>
          <p className="leading-relaxed text-muted-foreground">{analysis.scoreReasoning}</p>
        </div>
        <p className="border-t pt-4 text-xs text-muted-foreground">
          {analysis.model} · {(analysis.tokensIn + analysis.tokensOut).toLocaleString("pt-BR")}{" "}
          tokens · US$ {analysis.costEstimate.toFixed(4)} · {formatDate(analysis.createdAt, true)}
        </p>
      </CardContent>
    </Card>
  );
}

function MessageCard({ lead, analysis }: { lead: Lead; analysis: Analysis | null }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState(analysis?.firstMessage ?? "");
  const saved = analysis?.firstMessage ?? "";
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });

  const save = useMutation({
    mutationFn: () =>
      updateFirstMessage({ data: { analysisId: analysis?.id ?? "", firstMessage: message } }),
    onSuccess: async () => {
      toast.success("Mensagem salva");
      await refresh();
    },
    onError: () => toast.error("Não foi possível salvar a mensagem"),
  });
  const generate = useMutation({
    mutationFn: () => generateMessage({ data: { id: lead.id } }),
    onSuccess: async () => {
      toast.success("Mensagem gerada");
      await refresh();
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

  const busy = generate.isPending;
  const dirty = message !== saved;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Mensagem de primeiro contato</CardTitle>
        {analysis ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generate.mutate()}
            disabled={busy}
            title="A IA escreve uma nova mensagem com base na análise"
          >
            <SparklesIcon />
            {busy ? "Gerando…" : saved ? "Gerar outra" : "Gerar com IA"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {analysis && !saved && !message ? (
          <p className="text-sm text-muted-foreground">
            A nota ficou abaixo do limite das Configurações, então a mensagem não foi gerada
            automaticamente. Gere com a IA ou escreva a sua.
          </p>
        ) : null}
        <Textarea
          aria-label="Mensagem de primeiro contato"
          rows={7}
          className="text-[15px] leading-relaxed"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!analysis || busy}
        />
        <div className="flex flex-wrap items-center gap-2">
          {lead.phoneE164 ? (
            <Button asChild>
              <a href={whatsappLink(lead.phoneE164, message)} target="_blank" rel="noreferrer">
                <MessageCircleIcon /> Abrir no WhatsApp
              </a>
            </Button>
          ) : (
            <Button disabled title="O lead não tem um telefone válido">
              <MessageCircleIcon /> Abrir no WhatsApp
            </Button>
          )}
          <Button variant="outline" onClick={() => void copy()} disabled={!message}>
            <CopyIcon /> Copiar
          </Button>
          {dirty ? (
            <Button
              variant="ghost"
              onClick={() => save.mutate()}
              disabled={!analysis || save.isPending}
            >
              Salvar edição
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Nada é enviado automaticamente: o WhatsApp abre com o texto para você revisar e enviar.
        </p>
      </CardContent>
    </Card>
  );
}

function GoogleCard({ lead }: { lead: Lead }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Google</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <Info label="Endereço">{lead.address ?? "—"}</Info>
        <Info label="Telefone">
          <span className="tabular-nums">{lead.phone ?? "—"}</span>
          {lead.phone && !lead.phoneE164 ? (
            <span className="ml-1 text-xs text-muted-foreground">(formato não reconhecido)</span>
          ) : null}
        </Info>
        <Info label="Avaliação">
          {lead.rating !== null ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <StarIcon className="size-3.5 fill-warning text-warning" />
              {lead.rating.toFixed(1)}
              <span className="text-muted-foreground">
                · {lead.reviewCount ?? 0} {lead.reviewCount === 1 ? "avaliação" : "avaliações"}
              </span>
            </span>
          ) : (
            "Sem avaliações"
          )}
        </Info>
        <div className="flex flex-wrap gap-2 pt-1">
          {lead.mapsUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={lead.mapsUrl} target="_blank" rel="noreferrer">
                <MapPinIcon /> Google Maps
              </a>
            </Button>
          ) : null}
          {lead.website ? (
            <Button asChild variant="outline" size="sm">
              <a href={lead.website} target="_blank" rel="noreferrer">
                <ExternalLinkIcon /> Abrir site
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SiteCard({ lead }: { lead: Lead }) {
  const site = lead.siteData;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Site</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        <Info label="Leitura">{SITE_STATUS_LABELS[lead.siteStatus]}</Info>
        {site ? (
          <>
            {site.title ? <Info label="Título">{site.title}</Info> : null}
            <Info label="HTTPS">{site.https ? "Sim" : "Não"}</Info>
            {site.copyrightYear ? <Info label="Ano no rodapé">{site.copyrightYear}</Info> : null}
            <Info label="E-mails comerciais">{site.emails.join(", ") || "Nenhum encontrado"}</Info>
            <Info label="Redes sociais">
              {site.socialLinks.length > 0 ? (
                <ul className="grid gap-1">
                  {site.socialLinks.map((link) => (
                    <li key={link} className="truncate">
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-4 hover:underline"
                      >
                        {link.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                "Nenhuma encontrada"
              )}
            </Info>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NotesCard({ lead, onSaved }: { lead: Lead; onSaved: () => Promise<unknown> }) {
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
    <Card>
      <CardHeader>
        <CardTitle>Notas</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Textarea
          aria-label="Notas"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ex.: falei com a recepção, retornar na segunda."
        />
        {notes !== lead.notes ? (
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            Salvar notas
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <SectionLabel>{title}</SectionLabel>
      {items.length > 0 ? (
        <ul className="grid gap-1.5">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5 leading-relaxed">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-brand" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Nenhum identificado.</p>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-xs font-medium text-muted-foreground">{children}</h3>;
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

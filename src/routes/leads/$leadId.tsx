import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  CopyIcon,
  ExternalLinkIcon,
  MapPinIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  StarIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { LeadStatusBadge, ScoreBadge } from "@/components/lead-badges";
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
import { reanalyzeLead, updateFirstMessage, updateLead } from "@/server/leads";

export const Route = createFileRoute("/leads/$leadId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(leadQuery(params.leadId)),
  component: LeadPage,
});

const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  pending: "Ainda não lido",
  none: "Sem site",
  ok: "Lido com sucesso",
  unreachable: "Inacessível",
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
    onSuccess: refresh,
    onError: () => toast.error("Não foi possível atualizar o status"),
  });
  const reanalyzeMutation = useMutation({
    mutationFn: () => reanalyzeLead({ data: { id: lead.id } }),
    onSuccess: async () => {
      toast.success("Nova análise enfileirada");
      await refresh();
    },
    onError: () => toast.error("Não foi possível enfileirar a análise"),
  });

  return (
    <>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-light text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Leads
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl tracking-tight">{lead.name}</h1>
            <ScoreBadge
              score={lead.score}
              pending={lead.analysisStatus === "pending"}
              className="text-base"
            />
          </div>
          <p className="mt-1 text-sm font-light text-muted-foreground">
            {search ? `${search.niche} em ${search.city} · ` : ""}
            coletado em {formatDate(lead.createdAt)}
          </p>
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
          <Button
            variant="outline"
            onClick={() => reanalyzeMutation.mutate()}
            disabled={reanalyzeMutation.isPending || lead.analysisStatus === "pending"}
          >
            <RefreshCwIcon /> Reanalisar
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid content-start gap-6">
          <AnalysisCard lead={lead} analysis={analysis} />
          <MessageCard key={analysis?.id ?? "none"} lead={lead} analysis={analysis} />
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
        <CardContent className="text-sm font-light text-muted-foreground">
          {lead.analysisStatus === "error"
            ? `A análise falhou: ${lead.analysisError ?? "erro desconhecido"}. Use “Reanalisar” para tentar de novo.`
            : "A IA ainda está analisando este lead…"}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Análise</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 text-sm">
        <p className="leading-relaxed">{analysis.summary}</p>
        <div className="grid gap-6 sm:grid-cols-2">
          <BulletList title="Sinais de oportunidade" items={analysis.signals} />
          <BulletList title="Dores prováveis" items={analysis.painPoints} />
        </div>
        <div>
          <h3 className="mb-1.5 text-xs text-muted-foreground">Justificativa da nota</h3>
          <p className="leading-relaxed font-light">{analysis.scoreReasoning}</p>
        </div>
        <p className="text-xs font-light text-muted-foreground">
          {analysis.model} · {analysis.tokensIn + analysis.tokensOut} tokens · custo estimado US${" "}
          {analysis.costEstimate.toFixed(4)} · {formatDate(analysis.createdAt, true)}
        </p>
      </CardContent>
    </Card>
  );
}

function MessageCard({ lead, analysis }: { lead: Lead; analysis: Analysis | null }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState(analysis?.firstMessage ?? "");
  const saved = analysis?.firstMessage ?? "";

  const save = useMutation({
    mutationFn: () =>
      updateFirstMessage({ data: { analysisId: analysis?.id ?? "", firstMessage: message } }),
    onSuccess: async () => {
      toast.success("Mensagem salva");
      await queryClient.invalidateQueries({ queryKey: ["lead", lead.id] });
    },
    onError: () => toast.error("Não foi possível salvar a mensagem"),
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
    <Card>
      <CardHeader>
        <CardTitle>Mensagem sugerida</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {analysis && !analysis.firstMessage && !message ? (
          <p className="text-sm font-light text-muted-foreground">
            A nota ficou abaixo do limite configurado, então nenhuma mensagem foi gerada. Você pode
            escrever uma aqui.
          </p>
        ) : null}
        <Textarea
          aria-label="Mensagem de primeiro contato"
          rows={8}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={!analysis}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => save.mutate()}
            disabled={!analysis || message === saved || save.isPending}
          >
            Salvar edição
          </Button>
          <Button variant="outline" onClick={() => void copy()} disabled={!message}>
            <CopyIcon /> Copiar mensagem
          </Button>
          {lead.phoneE164 ? (
            <Button asChild>
              <a href={whatsappLink(lead.phoneE164, message)} target="_blank" rel="noreferrer">
                <MessageCircleIcon /> Abrir WhatsApp
              </a>
            </Button>
          ) : (
            <Button disabled title="Sem telefone válido">
              <MessageCircleIcon /> Abrir WhatsApp
            </Button>
          )}
        </div>
        <p className="text-xs font-light text-muted-foreground">
          Nada é enviado automaticamente. O WhatsApp abre com o texto para você revisar e enviar.
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
      <CardContent className="grid gap-3 text-sm">
        <Info label="Endereço">{lead.address ?? "—"}</Info>
        <Info label="Telefone">
          {lead.phone ?? "—"}
          {lead.phone && !lead.phoneE164 ? (
            <span className="ml-1 text-xs text-muted-foreground">(não reconhecido)</span>
          ) : null}
        </Info>
        <Info label="Avaliação">
          {lead.rating !== null ? (
            <span className="inline-flex items-center gap-1">
              <StarIcon className="size-3.5 fill-warning text-warning" />
              {lead.rating.toFixed(1)}
              <span className="text-muted-foreground">({lead.reviewCount ?? 0} avaliações)</span>
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
                <ExternalLinkIcon /> Site
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
      <CardContent className="grid gap-3 text-sm">
        <Info label="Leitura">{SITE_STATUS_LABELS[lead.siteStatus]}</Info>
        {site ? (
          <>
            <Info label="Título">{site.title ?? "—"}</Info>
            <Info label="HTTPS">{site.https ? "Sim" : "Não"}</Info>
            {site.copyrightYear ? <Info label="Ano no rodapé">{site.copyrightYear}</Info> : null}
            <Info label="E-mails comerciais">{site.emails.join(", ") || "—"}</Info>
            <Info label="Redes sociais">
              {site.socialLinks.length > 0 ? (
                <ul className="grid gap-0.5">
                  {site.socialLinks.map((link) => (
                    <li key={link} className="truncate">
                      <a href={link} target="_blank" rel="noreferrer" className="hover:underline">
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notas</CardTitle>
        <LeadStatusBadge status={lead.status} />
      </CardHeader>
      <CardContent className="grid gap-3">
        <Textarea
          aria-label="Notas"
          rows={5}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ex.: falei com a recepção, retornar na segunda."
        />
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => save.mutate()}
          disabled={notes === lead.notes || save.isPending}
        >
          Salvar notas
        </Button>
      </CardContent>
    </Card>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs text-muted-foreground">{title}</h3>
      {items.length > 0 ? (
        <ul className="grid gap-1 font-light">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 size-1 shrink-0 rounded-full bg-brand" />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-light text-muted-foreground">Nenhum identificado.</p>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="min-w-0 font-light break-words">{children}</div>
    </div>
  );
}

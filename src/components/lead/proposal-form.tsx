import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCents } from "@/lib/money";
import {
  customLinesFromForm,
  previewItems,
  PROPOSAL_VALID_DAYS,
  proposalTotals,
  type CustomLineForm,
  type ProposalDraft,
} from "@/lib/proposal";
import { proposalEmail, SALES_EMAILS_OFF, type EmailText } from "@/lib/sales-email";
import { priceLabel, serviceTerms } from "@/lib/services";
import type { ServiceTable } from "@/server/service-store";
import { ClientRequests } from "./client-requests";
import { EmailPreview } from "./email-preview";

/**
 * "Montar proposta": a service from the table, add-ons and the client's own requests, with the
 * live total. "Enviar proposta por e-mail" only while sending is on; "Salvar proposta" always.
 */
export function ProposalForm({
  table,
  leadName,
  hasEmail,
  emailsEnabled,
  today,
  busy,
  onConfirm,
  onCopy,
  onBack,
}: {
  table: ServiceTable;
  leadName: string;
  hasEmail: boolean;
  emailsEnabled: boolean;
  today: string;
  busy: boolean;
  onConfirm: (draft: ProposalDraft, sendEmail: boolean) => void;
  onCopy: (email: EmailText) => void;
  onBack: () => void;
}) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [lines, setLines] = useState<CustomLineForm[]>([]);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = previewItems(table, { serviceId, addonIds, lines });
  const totals = items ? proposalTotals(items) : null;
  const canEmail = emailsEnabled && hasEmail;

  if (table.services.length === 0) return <EmptyTable onBack={onBack} />;

  const toggleAddon = (id: string, checked: boolean) => {
    setAddonIds((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));
    setError(null);
  };
  const submit = (sendEmail: boolean) => {
    if (!serviceId) {
      setError("Escolha o serviço.");
      return;
    }
    const custom = customLinesFromForm(lines);
    if (!custom.ok) {
      setError(custom.error);
      return;
    }
    onConfirm({ serviceId, addonIds, custom: custom.value }, sendEmail);
  };

  return (
    <div className="grid w-full gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="proposal-service">Serviço</Label>
        <Select
          value={serviceId ?? ""}
          onValueChange={(value) => {
            setServiceId(value);
            setError(null);
          }}
        >
          <SelectTrigger id="proposal-service" className="w-full">
            <SelectValue placeholder="Escolha da tabela" />
          </SelectTrigger>
          <SelectContent>
            {table.services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name} · {serviceTerms(service)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {table.addons.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Adicionais</legend>
          {table.addons.map((addon) => (
            <div key={addon.id} className="flex items-center gap-2.5">
              <Checkbox
                id={`addon-${addon.id}`}
                checked={addonIds.includes(addon.id)}
                onCheckedChange={(value) => toggleAddon(addon.id, value === true)}
              />
              <Label htmlFor={`addon-${addon.id}`} className="flex-1 font-normal">
                {addon.name}
              </Label>
              <span className="text-sm text-muted-foreground tabular-nums">
                {priceLabel(addon)}
              </span>
            </div>
          ))}
        </fieldset>
      ) : null}
      <div className="grid gap-1.5">
        <p className="text-sm font-medium">Pedido do cliente</p>
        <ClientRequests
          lines={lines}
          onChange={(next) => {
            setLines(next);
            setError(null);
          }}
        />
      </div>
      <ProposalTotal totals={totals} />
      {preview && items ? (
        <EmailPreview
          email={proposalEmail({ leadName, items, validDays: PROPOSAL_VALID_DAYS, today })}
          emailsEnabled={emailsEnabled}
          onCopy={onCopy}
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {canEmail ? (
          <Button disabled={busy} onClick={() => submit(true)}>
            {busy ? "Enviando…" : "Enviar proposta por e-mail"}
          </Button>
        ) : null}
        <Button
          variant={canEmail ? "outline" : "default"}
          disabled={busy}
          onClick={() => submit(false)}
        >
          {busy && !canEmail ? "Salvando…" : "Salvar proposta"}
        </Button>
        <Button variant="outline" disabled={!items} onClick={() => setPreview((open) => !open)}>
          {preview ? "Fechar prévia" : "Ver como o cliente vê"}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onBack}>
          Voltar
        </Button>
      </div>
      {canEmail ? null : (
        <p className="text-sm text-orange">
          {hasEmail ? SALES_EMAILS_OFF : "Este lead não tem e-mail"}: a proposta fica salva e o
          texto pode ser copiado.
        </p>
      )}
    </div>
  );
}

function ProposalTotal({
  totals,
}: {
  totals: { totalCents: number; monthlyCents: number } | null;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-fill-3 px-3 py-2.5">
      <span className="text-sm text-muted-foreground">
        Total · válida por {PROPOSAL_VALID_DAYS} dias
      </span>
      <span className="text-right">
        <b className="text-lg font-semibold tabular-nums">
          {totals ? formatCents(totals.totalCents) : "—"}
        </b>
        {totals && totals.monthlyCents > 0 ? (
          <span className="block text-xs text-muted-foreground tabular-nums">
            {formatCents(totals.monthlyCents)} deste valor se repetem todo mês
          </span>
        ) : null}
      </span>
    </div>
  );
}

function EmptyTable({ onBack }: { onBack: () => void }) {
  return (
    <div className="grid w-full gap-2">
      <p className="text-sm text-muted-foreground">
        A tabela de serviços está vazia.{" "}
        <Link to="/settings/servicos" className="text-blue underline-offset-4 hover:underline">
          Cadastre os serviços e preços
        </Link>{" "}
        para montar uma proposta.
      </p>
      <Button variant="ghost" className="justify-self-start" onClick={onBack}>
        Voltar
      </Button>
    </div>
  );
}

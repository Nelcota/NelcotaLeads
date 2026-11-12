import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { wonDealFromForm, type WonDeal, type WonDealForm } from "@/lib/deal-form";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money";
import { wonPrefill } from "@/lib/proposal";
import type { ProposalItem } from "@/lib/schemas";
import { priceLabel } from "@/lib/services";

/**
 * "Fechar negócio": value (R$), the day it closed (today by default) and the service sold.
 * With a proposal, its lines are listed and the value and service start from it, still editable.
 */
export function CloseWonForm({
  today,
  proposal,
  busy,
  onConfirm,
  onBack,
}: {
  today: string;
  proposal: { items: ProposalItem[]; totalCents: number } | null;
  busy: boolean;
  onConfirm: (deal: WonDeal) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState<WonDealForm>(() => ({
    value: "",
    service: "",
    ...wonPrefill(proposal),
    closedOn: today,
  }));
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<WonDealForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = wonDealFromForm(form, today);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirm(result.deal);
  };

  return (
    <form className="grid w-full gap-3" onSubmit={submit} noValidate>
      {proposal ? <ProposalLines items={proposal.items} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="deal-value">Valor</Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              id="deal-value"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              className="pl-9 tabular-nums"
              value={form.value}
              onChange={(event) => change({ value: event.target.value })}
              onBlur={() => {
                const cents = parseMoneyInput(form.value);
                if (cents !== null) change({ value: formatMoneyInput(cents) });
              }}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="deal-closed-on">Data do fechamento</Label>
          <Input
            id="deal-closed-on"
            type="date"
            max={today}
            className="tabular-nums"
            value={form.closedOn}
            onChange={(event) => change({ closedOn: event.target.value })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="deal-service">Serviço</Label>
        <Input
          id="deal-service"
          autoComplete="off"
          maxLength={120}
          placeholder="Ex.: Site institucional"
          value={form.service}
          onChange={(event) => change({ service: event.target.value })}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? "Fechando…" : "Confirmar"}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onBack}>
          Voltar
        </Button>
      </div>
    </form>
  );
}

/** The latest proposal's lines, read-only, above the value they add up to. */
function ProposalLines({ items }: { items: readonly ProposalItem[] }) {
  return (
    <div className="grid gap-1 rounded-lg bg-fill-3 px-3 py-2.5 text-sm">
      <p className="text-xs font-medium text-muted-foreground">Da última proposta</p>
      <ul className="grid gap-0.5">
        {items.map((item, index) => (
          <li key={`${item.kind}-${index}`} className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{priceLabel(item)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

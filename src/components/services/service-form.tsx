import { useEffect, useState } from "react";
import { useReportDirtyForm } from "@/components/leave-guard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { sameFields, serviceFromForm, type ServiceForm as ServiceFields } from "@/lib/service-form";
import { SERVICE_LIMITS, type ServiceInput } from "@/lib/services";
import { MoneyInput } from "./money-input";
import { RowFormActions } from "./row-form-actions";

/** Adds or edits one service: name, what it includes, base price and the deadline (or monthly). */
export function ServiceForm({
  initial,
  busy,
  onSave,
  onCancel,
  onDirtyChange,
}: {
  initial: ServiceFields;
  busy: boolean;
  onSave: (input: ServiceInput) => void;
  onCancel: () => void;
  /** Whether the form differs from what it opened with, for the table's guard. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [form, setForm] = useState(initial);
  const dirty = !sameFields(form, initial);
  // Leaving the page with an open, changed row asks first (the page's LeaveGuard).
  useReportDirtyForm("service-row", dirty);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<ServiceFields>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = serviceFromForm(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSave(result.value);
  };

  return (
    <form className="grid gap-3 px-4 py-3" onSubmit={submit} noValidate>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid gap-1.5">
          <Label htmlFor="service-name">Nome</Label>
          <Input
            id="service-name"
            autoComplete="off"
            maxLength={SERVICE_LIMITS.name}
            placeholder="Ex.: Site institucional"
            value={form.name}
            onChange={(event) => change({ name: event.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="service-price">Preço base</Label>
          <MoneyInput
            id="service-price"
            value={form.price}
            onChange={(price) => change({ price })}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="service-detail">O que inclui</Label>
        <Input
          id="service-detail"
          autoComplete="off"
          maxLength={SERVICE_LIMITS.detail}
          placeholder="Ex.: Até 5 páginas e formulário de contato"
          value={form.detail}
          onChange={(event) => change({ detail: event.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center gap-2.5">
          <Switch
            id="service-monthly"
            checked={form.monthly}
            onCheckedChange={(monthly) => change({ monthly })}
          />
          <Label htmlFor="service-monthly" className="font-normal">
            Mensal
          </Label>
        </div>
        {form.monthly ? null : (
          <div className="flex items-center gap-2">
            <Label htmlFor="service-deadline" className="font-normal">
              Prazo
            </Label>
            <Input
              id="service-deadline"
              inputMode="numeric"
              autoComplete="off"
              className="w-20 tabular-nums"
              value={form.deadline}
              onChange={(event) => change({ deadline: event.target.value })}
            />
            <span className="text-sm text-muted-foreground">dias</span>
          </div>
        )}
      </div>
      <RowFormActions error={error} busy={busy} onCancel={onCancel} />
    </form>
  );
}

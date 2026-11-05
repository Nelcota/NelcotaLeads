import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { addonFromForm, type AddonForm as AddonFields } from "@/lib/service-form";
import { SERVICE_LIMITS, type AddonInput } from "@/lib/services";
import { MoneyInput } from "./money-input";
import { RowFormActions } from "./row-form-actions";

/** Adds or edits one add-on: name, what it applies to, price and whether it is monthly. */
export function AddonForm({
  initial,
  busy,
  onSave,
  onCancel,
}: {
  initial: AddonFields;
  busy: boolean;
  onSave: (input: AddonInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<AddonFields>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = addonFromForm(form);
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
          <Label htmlFor="addon-name">Nome</Label>
          <Input
            id="addon-name"
            autoComplete="off"
            maxLength={SERVICE_LIMITS.name}
            placeholder="Ex.: Página extra"
            value={form.name}
            onChange={(event) => change({ name: event.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="addon-price">Preço</Label>
          <MoneyInput id="addon-price" value={form.price} onChange={(price) => change({ price })} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="addon-scope">Vale para</Label>
          <Input
            id="addon-scope"
            autoComplete="off"
            maxLength={SERVICE_LIMITS.scope}
            value={form.scope}
            onChange={(event) => change({ scope: event.target.value })}
          />
        </div>
        <div className="flex h-9 items-center gap-2.5">
          <Switch
            id="addon-monthly"
            checked={form.monthly}
            onCheckedChange={(monthly) => change({ monthly })}
          />
          <Label htmlFor="addon-monthly" className="font-normal">
            Mensal
          </Label>
        </div>
      </div>
      <RowFormActions error={error} busy={busy} onCancel={onCancel} />
    </form>
  );
}

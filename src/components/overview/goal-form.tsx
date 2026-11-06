import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GoalFormValues } from "@/lib/goal";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money";

type GoalFormProps = {
  values: GoalFormValues;
  error: string | null;
  saving: boolean;
  onChange: (patch: Partial<GoalFormValues>) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

/** "Editar meta": deals and revenue for the month, with Salvar and Cancelar. */
export function GoalForm({ values, error, saving, onChange, onSubmit, onCancel }: GoalFormProps) {
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  return (
    <form className="grid gap-3 border-t border-border/60 px-5 py-4" onSubmit={submit} noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="goal-deals">Fechamentos no mês</Label>
          <Input
            id="goal-deals"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ex.: 10"
            className="tabular-nums"
            value={values.deals}
            onChange={(event) => onChange({ deals: event.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="goal-revenue">Receita no mês</Label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              id="goal-revenue"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              className="pl-9 tabular-nums"
              value={values.revenue}
              onChange={(event) => onChange({ revenue: event.target.value })}
              onBlur={() => {
                const cents = parseMoneyInput(values.revenue);
                if (cents !== null) onChange({ revenue: formatMoneyInput(cents) });
              }}
            />
          </div>
        </div>
      </div>
      <p className="text-[12.5px] text-muted-foreground">
        Vale a partir deste mês. Os meses anteriores mantêm a meta que tinham.
      </p>
      {error ? (
        <p role="alert" className="text-[12.5px] text-red">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

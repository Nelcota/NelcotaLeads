import { NumberInput } from "@/components/number-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { GoalFormValues } from "@/lib/goal";

type GoalFormProps = {
  values: GoalFormValues;
  error: string | null;
  saving: boolean;
  onChange: (patch: Partial<GoalFormValues>) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

/**
 * "Editar meta": deals and revenue for the month, formatted in pt-BR as they are typed, with
 * Salvar (Enter) and Cancelar (Esc).
 */
export function GoalForm({ values, error, saving, onChange, onSubmit, onCancel }: GoalFormProps) {
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit();
  };
  const cancelOnEscape = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape" || saving) return;
    event.preventDefault();
    onCancel();
  };
  const errorProps = error ? { "aria-invalid": true, "aria-describedby": "goal-error" } : {};
  return (
    <form
      className="grid gap-3 border-t border-border/60 px-5 py-4"
      onSubmit={submit}
      onKeyDown={cancelOnEscape}
      noValidate
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="goal-deals">Fechamentos no mês</Label>
          <NumberInput
            id="goal-deals"
            kind="whole"
            autoFocus
            placeholder="Ex.: 10"
            {...errorProps}
            value={values.deals}
            onValueChange={(deals) => onChange({ deals })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="goal-revenue">Receita no mês</Label>
          <NumberInput
            id="goal-revenue"
            kind="money"
            placeholder="0,00"
            {...errorProps}
            value={values.revenue}
            onValueChange={(revenue) => onChange({ revenue })}
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Vale a partir deste mês. Os meses anteriores mantêm a meta que tinham.
      </p>
      {error ? (
        <p id="goal-error" role="alert" className="text-sm text-red">
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

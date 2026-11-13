import { MinusIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money";
import { PROPOSAL_LIMITS, type CustomLineForm } from "@/lib/proposal";
import { SERVICE_LIMITS } from "@/lib/services";

/** "Pedido do cliente": extras the client asked for, each a label and a value in R$. */
export function ClientRequests({
  lines,
  onChange,
}: {
  lines: readonly CustomLineForm[];
  onChange: (lines: CustomLineForm[]) => void;
}) {
  const update = (key: string, patch: Partial<CustomLineForm>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const add = () => onChange([...lines, { key: crypto.randomUUID(), label: "", price: "" }]);
  const remove = (key: string) => onChange(lines.filter((line) => line.key !== key));
  const full = lines.length >= PROPOSAL_LIMITS.custom;

  return (
    <div className="grid gap-2">
      {lines.map((line, index) => (
        <div key={line.key} className="flex items-center gap-2">
          <Input
            aria-label={`Pedido do cliente ${index + 1}`}
            autoComplete="off"
            maxLength={SERVICE_LIMITS.name}
            placeholder="Ex.: Galeria de fotos"
            value={line.label}
            onChange={(event) => update(line.key, { label: event.target.value })}
          />
          <div className="relative w-36 shrink-0">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
              R$
            </span>
            <Input
              aria-label={`Valor do pedido ${index + 1}`}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              className="pl-9 tabular-nums"
              value={line.price}
              onChange={(event) => update(line.key, { price: event.target.value })}
              onBlur={() => {
                const cents = parseMoneyInput(line.price);
                if (cents !== null) update(line.key, { price: formatMoneyInput(cents) });
              }}
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="icon-sm"
            aria-label={`Remover pedido ${index + 1}`}
            onClick={() => remove(line.key)}
          >
            <MinusIcon className="size-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-self-start text-blue hover:text-blue"
        disabled={full}
        onClick={add}
      >
        <PlusIcon />
        Pedido do cliente
      </Button>
    </div>
  );
}

import { Input } from "@/components/ui/input";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money";

/** A pt-BR money field with "R$" inside; tidies the value to "1.490,00" on blur. */
export function MoneyInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder="0,00"
        className="pl-9 tabular-nums"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          const cents = parseMoneyInput(value);
          if (cents !== null) onChange(formatMoneyInput(cents));
        }}
      />
    </div>
  );
}

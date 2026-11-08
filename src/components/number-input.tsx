import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money";
import {
  caretAfter,
  decimalDotToComma,
  maskNumber,
  significantBefore,
  type NumberMaskKind,
} from "@/lib/number-mask";
import { cn } from "@/lib/utils";

type NumberInputProps = Omit<
  ComponentProps<"input">,
  "value" | "onChange" | "type" | "inputMode"
> & {
  kind: NumberMaskKind;
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * A pt-BR number field that formats as the person types ("1.000", "R$ 1.500,50") and keeps the
 * caret where it was. Money fields show "R$" inside and complete the cents on blur.
 */
export function NumberInput({
  kind,
  value,
  onValueChange,
  onBlur,
  className,
  ...props
}: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // After the masked value renders, put the caret back where the keystroke left it.
  useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    if (!input || caret === null || document.activeElement !== input) return;
    input.setSelectionRange(caret, caret);
  });

  const change = (event: React.ChangeEvent<HTMLInputElement>) => {
    const typed = kind === "money" ? decimalDotToComma(event.target.value) : event.target.value;
    const caret = event.target.selectionStart ?? typed.length;
    const masked = maskNumber(kind, typed);
    pendingCaret.current = caretAfter(masked, significantBefore(typed, caret));
    onValueChange(masked);
  };

  const blur = (event: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(event);
    if (kind !== "money") return;
    const cents = parseMoneyInput(value);
    if (cents === null) return;
    onValueChange(formatMoneyInput(cents));
  };

  const input = (
    <Input
      {...props}
      ref={inputRef}
      type="text"
      inputMode={kind === "money" ? "decimal" : "numeric"}
      autoComplete="off"
      className={cn("tabular-nums", kind === "money" && "pl-9", className)}
      value={value}
      onChange={change}
      onBlur={blur}
    />
  );
  if (kind !== "money") return input;

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
        R$
      </span>
      {input}
    </div>
  );
}

import { MinusIcon, PlusIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { Hint } from "@/components/apple-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { stepValue } from "@/lib/step";
import { cn } from "@/lib/utils";

/**
 * A number field between − and + buttons, drawn as one input (the native spinners are hidden
 * in styles.css). The input itself stays uncontrolled, so `register(...)` spreads onto it;
 * the buttons hand the next value to `onStep`.
 */
export function NumberStepper({
  current,
  min,
  max,
  step = 1,
  onStep,
  className,
  inputClassName,
  ...props
}: Omit<ComponentProps<"input">, "type" | "min" | "max" | "step" | "className"> & {
  /** The value in the field now (watched from the form). */
  current: number | undefined;
  min: number;
  max: number;
  step?: number;
  onStep: (value: number) => void;
  className?: string;
  inputClassName?: string;
}) {
  const value = current ?? Number.NaN;
  const atMin = Number.isFinite(value) && value <= min;
  const atMax = Number.isFinite(value) && value >= max;
  const press = (direction: 1 | -1) => onStep(stepValue(value, direction, { min, max, step }));

  return (
    <div
      data-slot="number-stepper"
      className={cn(
        "flex h-9 items-center rounded-[10px] bg-black/[0.03] p-1 shadow-[inset_0_0_0_1px_var(--input)] transition-[box-shadow] focus-within:shadow-[inset_0_0_0_1px_var(--ring)] focus-within:ring-3 focus-within:ring-ring/30 has-[[aria-invalid=true]]:ring-3 has-[[aria-invalid=true]]:ring-destructive/20 dark:bg-black/25",
        className,
      )}
    >
      <Hint label="Diminuir">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Diminuir"
          disabled={atMin}
          onClick={() => press(-1)}
        >
          <MinusIcon />
        </Button>
      </Hint>
      <Input
        {...props}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        className={cn(
          "h-full min-w-0 flex-1 rounded-[6px] bg-transparent! px-0.5 text-center font-medium tabular-nums shadow-none! focus-visible:ring-0 aria-invalid:ring-0",
          inputClassName,
        )}
      />
      <Hint label="Aumentar">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Aumentar"
          disabled={atMax}
          onClick={() => press(1)}
        >
          <PlusIcon />
        </Button>
      </Hint>
    </div>
  );
}

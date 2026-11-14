import { MinusIcon, PlusIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

/**
 * An hour of the day as "− 8h +", in place of a list that opens over the page. Each click moves
 * one hour; the buttons stop at the first and last hour allowed.
 */
export function HourStepper({
  label,
  value,
  min = 0,
  max = 23,
  disabled = false,
  onChange,
}: {
  /** Names the group and both buttons for screen readers ("Início dos envios"). */
  label: string;
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (hour: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex h-10 items-center gap-1 justify-self-start rounded-full border border-border px-1"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`${label}: uma hora antes`}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        <MinusIcon aria-hidden />
      </Button>
      <output aria-live="polite" className="min-w-10 text-center font-medium tabular-nums">
        {value}h
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`${label}: uma hora depois`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <PlusIcon aria-hidden />
      </Button>
    </div>
  );
}

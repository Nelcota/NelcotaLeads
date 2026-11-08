import type { KeyboardEvent } from "react";
import { ChoicePill } from "@/components/ui/choice-pill";
import { cn } from "@/lib/utils";

type Option<Value extends string> = { value: Value; label: string };

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

/**
 * A one-of-a-few choice drawn as standard choice pills, with radio semantics: Tab reaches the chosen
 * option and the arrow keys move the choice, like a native radio group.
 */
export function SegmentedControl<Value extends string>({
  label,
  value,
  options,
  onChange,
  size = "default",
  className,
}: {
  label: string;
  /** "sm" for the compact notification panel. */
  size?: "default" | "sm";
  value: Value;
  options: readonly Option<Value>[];
  onChange: (value: Value) => void;
  className?: string;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const current = options.findIndex((option) => option.value === value);
    const next = options[(current + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons[options.indexOf(next)]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("flex gap-1.5", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <ChoicePill
            key={option.value}
            size={size}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            selected={selected}
            onClick={() => onChange(option.value)}
            className="flex-1"
          >
            {option.label}
          </ChoicePill>
        );
      })}
    </div>
  );
}

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

type Option<Value extends string> = { value: Value; label: string };

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

/**
 * A one-of-a-few choice drawn as a pill track, with radio semantics: Tab reaches the chosen
 * option and the arrow keys move the choice, like a native radio group.
 */
export function SegmentedControl<Value extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
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
      className={cn("flex gap-0.5 rounded-full bg-fill-2 p-[3px]", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 flex-1 rounded-full px-3 text-[13px] font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              selected
                ? "bg-card font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--border)] dark:bg-[#3a3a40]"
                : "text-muted-foreground hover:bg-fill hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

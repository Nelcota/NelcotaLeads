import type { KeyboardEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FollowUpOption = { days: number; label: string };

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

/**
 * The follow-up day as one row of visible options, the same in every stage of the lead panel.
 * Radio semantics: Tab reaches the chosen option and the arrow keys move the choice. The chosen
 * one is neutral (grey fill, semibold): solid blue stays for the card's main action.
 */
export function FollowUpChoice({
  label,
  days,
  options,
  disabled,
  onChange,
}: {
  label: string;
  /** The chosen option, or null when the saved day matches none of them. */
  days: number | null;
  options: readonly FollowUpOption[];
  disabled?: boolean;
  onChange: (days: number) => void;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP[event.key];
    if (!step) return;
    event.preventDefault();
    const current = options.findIndex((option) => option.days === days);
    const next = options[(Math.max(current, 0) + step + options.length) % options.length];
    if (!next) return;
    onChange(next.days);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
    buttons[options.indexOf(next)]?.focus();
  };
  const tabStop = days ?? options[0]?.days;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex min-w-0 flex-1 flex-wrap gap-2"
    >
      {options.map((option) => {
        const selected = option.days === days;
        return (
          <button
            key={option.days}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={option.days === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.days)}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "flex-1",
              selected && "border-transparent bg-fill font-semibold hover:bg-fill",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

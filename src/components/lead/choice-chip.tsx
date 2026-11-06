import { cn } from "@/lib/utils";

/** One option of a single-choice row of chips (a radio button that looks like a pill). */
export function ChoiceChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "h-7 rounded-full px-3 text-[12.5px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        selected ? "bg-primary text-primary-foreground" : "bg-fill-2 text-foreground hover:bg-fill",
      )}
    >
      {label}
    </button>
  );
}

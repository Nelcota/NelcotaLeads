import { ChoicePill } from "@/components/ui/choice-pill";

/** One option of a single-choice row of chips in a form (a radio button that looks like a pill). */
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
    <ChoicePill
      size="sm"
      role="radio"
      aria-checked={selected}
      selected={selected}
      onClick={onSelect}
    >
      {label}
    </ChoicePill>
  );
}

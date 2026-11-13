import { Hint } from "@/components/apple-ui";
import { ChoicePill } from "@/components/ui/choice-pill";
import { GLOSSARY } from "@/lib/help";
import { cn } from "@/lib/utils";

export const CONVERSATION_FILTERS = ["all", "needsYou", "aiTalking", "waiting", "closed"] as const;
export type ConversationFilter = (typeof CONVERSATION_FILTERS)[number];

const FILTER_LABELS: Record<ConversationFilter, string> = {
  all: "Todas",
  needsYou: "Precisa de você",
  aiTalking: "IA conversando",
  waiting: "Sem resposta",
  closed: "Encerradas",
};

/**
 * The conversation filters as pills. "row" lines them up beside the page title (desktop);
 * "grid" is the column version: "Todas" across the top, then two per row,
 * so nothing scrolls sideways and every count lines up on the right.
 */
export function ConversationFilters({
  value,
  countOf,
  onChange,
  layout = "grid",
}: {
  value: ConversationFilter;
  countOf: (filter: ConversationFilter) => number;
  onChange: (filter: ConversationFilter) => void;
  layout?: "grid" | "row";
}) {
  const row = layout === "row";
  return (
    <div
      role="group"
      aria-label="Filtrar conversas"
      // The row never wraps: the header has a fixed height, so long counts scroll sideways
      // instead (p-1 -m-1 keeps the focus ring inside the scroll box).
      className={
        row
          ? "-m-1 flex items-center gap-2 overflow-x-auto p-1 [scrollbar-width:none]"
          : "grid grid-cols-2 gap-2"
      }
    >
      {CONVERSATION_FILTERS.map((filter) => {
        const pill = (
          <ChoicePill
            key={filter}
            aria-pressed={filter === value}
            selected={filter === value}
            count={String(countOf(filter))}
            className={cn(
              row ? "h-9 shrink-0 gap-2.5 px-3.5" : "w-full justify-between",
              !row && filter === "all" && "col-span-2",
              filter !== value && "border-transparent bg-fill-3 hover:bg-fill-2",
            )}
            onClick={() => onChange(filter)}
          >
            {FILTER_LABELS[filter]}
          </ChoicePill>
        );
        if (filter !== "needsYou") return pill;
        return (
          <Hint key={filter} label={GLOSSARY.needsYou.text}>
            {pill}
          </Hint>
        );
      })}
    </div>
  );
}

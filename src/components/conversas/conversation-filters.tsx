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
 * The conversation filters as one fixed grid of pills: "Todas" across the top, then two per row,
 * so nothing scrolls sideways and every count lines up on the right.
 */
export function ConversationFilters({
  value,
  countOf,
  onChange,
}: {
  value: ConversationFilter;
  countOf: (filter: ConversationFilter) => number;
  onChange: (filter: ConversationFilter) => void;
}) {
  return (
    <div role="group" aria-label="Filtrar conversas" className="grid grid-cols-2 gap-2">
      {CONVERSATION_FILTERS.map((filter) => {
        const pill = (
          <ChoicePill
            key={filter}
            aria-pressed={filter === value}
            selected={filter === value}
            count={String(countOf(filter))}
            className={cn("w-full justify-between", filter === "all" && "col-span-2")}
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

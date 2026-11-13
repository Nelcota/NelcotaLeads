import { ChoicePill } from "@/components/ui/choice-pill";
import type { Search } from "@/db/schema";
import { formatCount } from "@/lib/format";
import {
  countSearches,
  SEARCH_FILTER_IDS,
  SEARCH_FILTER_LABELS,
  type SearchFilter,
} from "@/lib/search-list";

/**
 * The Histórico filters as toggle buttons (`aria-pressed`): pressing the active one again turns
 * it off and goes back to "Todas", which a radio group could not do.
 */
export function SearchFilterBar({
  searches,
  filter,
  onChange,
}: {
  searches: readonly Search[];
  filter: SearchFilter;
  onChange: (filter: SearchFilter) => void;
}) {
  return (
    <div role="group" aria-label="Filtrar buscas" className="flex flex-wrap gap-2">
      {SEARCH_FILTER_IDS.map((id) => {
        const count = countSearches(searches, id);
        const active = filter === id;
        return (
          <ChoicePill
            key={id}
            size="sm"
            aria-pressed={active}
            selected={active}
            count={count > 0 ? formatCount(count) : undefined}
            onClick={() => onChange(active ? "all" : id)}
          >
            {SEARCH_FILTER_LABELS[id]}
          </ChoicePill>
        );
      })}
    </div>
  );
}

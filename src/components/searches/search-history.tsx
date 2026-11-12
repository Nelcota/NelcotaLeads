import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { SearchRow } from "@/components/searches/search-row";
import { Button } from "@/components/ui/button";
import { ChoicePill } from "@/components/ui/choice-pill";
import type { Search } from "@/db/schema";
import { formatCount } from "@/lib/format";
import {
  countSearches,
  matchesSearchFilter,
  SEARCH_FILTER_IDS,
  SEARCH_FILTER_LABELS,
  summarizeSearches,
  type SearchFilter,
} from "@/lib/search-list";

/** Rows shown before "Mostrar mais". */
const FIRST_ROWS = 10;

function plural(count: number, one: string, many: string): string {
  return `${formatCount(count)} ${count === 1 ? one : many}`;
}

function Summary({ searches }: { searches: readonly Search[] }) {
  const summary = summarizeSearches(searches);
  const parts = [
    plural(summary.searches, "busca", "buscas"),
    plural(summary.newLeads, "lead novo", "leads novos"),
  ];
  if (summary.running > 0) parts.push(`${formatCount(summary.running)} em andamento`);
  return <p className="text-sm text-muted-foreground tabular-nums">{parts.join(" · ")}</p>;
}

function EmptyHistory({ filtered, onShowAll }: { filtered: boolean; onShowAll: () => void }) {
  if (filtered) {
    return (
      <div className="grid justify-items-center gap-2 border-b border-border px-6 py-12 text-center">
        <p className="text-lg font-semibold">Nenhuma busca neste filtro</p>
        <Button variant="ghost" size="sm" onClick={onShowAll}>
          Ver todas
        </Button>
      </div>
    );
  }
  return (
    <div className="grid justify-items-center gap-2 border-b border-border px-6 py-14 text-center">
      <SearchIcon aria-hidden strokeWidth={1.6} className="size-7 text-muted-foreground" />
      <p className="text-xl font-semibold">Nenhuma busca ainda</p>
      <p className="max-w-md text-base text-pretty text-muted-foreground">
        As buscas diárias e as que você fizer aparecem aqui.
      </p>
    </div>
  );
}

/**
 * The Histórico: one open list with its filters right above it, first rows only until
 * "Mostrar mais". A second click on the active filter goes back to "Todas".
 */
export function SearchHistory({
  searches,
  filter,
  onFilterChange,
  quotaSpent,
  onFill,
}: {
  searches: readonly Search[];
  filter: SearchFilter;
  onFilterChange: (filter: SearchFilter) => void;
  quotaSpent: boolean;
  onFill: (niche: string, city: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = searches.filter((search) => matchesSearchFilter(search, filter));
  const visibleRows = showAll ? rows : rows.slice(0, FIRST_ROWS);
  const hiddenCount = rows.length - visibleRows.length;
  const pick = (next: SearchFilter) => {
    setShowAll(false);
    onFilterChange(next === filter ? "all" : next);
  };

  return (
    <section aria-labelledby="historico" className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="historico" className="text-base font-semibold text-muted-foreground">
          Histórico
        </h2>
        {searches.length > 0 ? <Summary searches={searches} /> : null}
      </div>
      {searches.length > 0 ? (
        <div role="radiogroup" aria-label="Filtrar buscas" className="flex flex-wrap gap-2">
          {SEARCH_FILTER_IDS.map((id) => {
            const count = countSearches(searches, id);
            return (
              <ChoicePill
                key={id}
                role="radio"
                aria-checked={filter === id}
                selected={filter === id}
                count={count > 0 ? formatCount(count) : undefined}
                onClick={() => pick(id)}
              >
                {SEARCH_FILTER_LABELS[id]}
              </ChoicePill>
            );
          })}
        </div>
      ) : null}
      <ul className="border-t border-input">
        {visibleRows.map((search) => (
          <SearchRow key={search.id} search={search} quotaSpent={quotaSpent} onFill={onFill} />
        ))}
      </ul>
      {rows.length === 0 ? (
        <EmptyHistory filtered={searches.length > 0} onShowAll={() => pick("all")} />
      ) : null}
      {rows.length > FIRST_ROWS ? (
        <Button
          variant="outline"
          className="justify-self-start"
          aria-expanded={showAll}
          onClick={() => setShowAll((open) => !open)}
        >
          {showAll ? "Mostrar menos" : `Mostrar mais ${plural(hiddenCount, "busca", "buscas")}`}
        </Button>
      ) : null}
    </section>
  );
}

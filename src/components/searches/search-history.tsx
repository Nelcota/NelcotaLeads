import { HistoryIcon } from "lucide-react";
import { useState } from "react";
import { SearchFilterBar } from "@/components/searches/search-filter-bar";
import { SearchHistoryEmpty, type EmptyKind } from "@/components/searches/search-history-empty";
import { SearchRow } from "@/components/searches/search-row";
import { Button } from "@/components/ui/button";
import type { Search } from "@/db/schema";
import { formatCount } from "@/lib/format";
import { matchesSearchFilter, type SearchFilter } from "@/lib/search-list";

/** Rows shown before "Mostrar mais". */
const FIRST_ROWS = 10;

function emptyKind(searches: readonly Search[], filter: SearchFilter): EmptyKind {
  if (searches.length === 0) return "none";
  const visible = searches.some((search) => search.hiddenAt === null);
  if (filter === "all" && !visible) return "all-hidden";
  return "filtered";
}

/**
 * The Histórico card: filters in its header, one row per search, first rows only until
 * "Mostrar mais".
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
  const moreCount = rows.length - FIRST_ROWS;
  const changeFilter = (next: SearchFilter) => {
    setShowAll(false);
    onFilterChange(next);
  };

  return (
    <section aria-labelledby="historico" className="grouped @container min-w-0">
      <div className="flex flex-col gap-3 border-b border-border p-5">
        <h2 id="historico" className="flex items-center gap-2 text-lg font-semibold">
          <HistoryIcon aria-hidden className="size-[18px] shrink-0 text-blue" strokeWidth={2} />
          Histórico
        </h2>
        {searches.length > 0 ? (
          <SearchFilterBar searches={searches} filter={filter} onChange={changeFilter} />
        ) : null}
      </div>
      {rows.length > 0 ? (
        <ul className="divide-y divide-border">
          {visibleRows.map((search) => (
            <SearchRow key={search.id} search={search} quotaSpent={quotaSpent} onFill={onFill} />
          ))}
        </ul>
      ) : (
        <SearchHistoryEmpty
          kind={emptyKind(searches, filter)}
          onShowAll={() => changeFilter("all")}
          onShowHidden={() => changeFilter("hidden")}
        />
      )}
      {moreCount > 0 ? (
        <div className="border-t border-border px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={showAll}
            onClick={() => setShowAll((open) => !open)}
          >
            {showAll
              ? "Mostrar menos"
              : `Mostrar mais ${formatCount(moreCount)} ${moreCount === 1 ? "busca" : "buscas"}`}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

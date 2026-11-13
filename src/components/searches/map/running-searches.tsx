import { SearchResult } from "@/components/searches/search-result";
import { searchLabel } from "@/lib/searches";
import type { SearchWithState } from "@/lib/search-state";

/** Searches still running in a state: what is searched, how far it got, its progress bar. */
export function RunningSearches({ searches }: { searches: readonly SearchWithState[] }) {
  return (
    <ul className="divide-y divide-border">
      {searches.map((search) => (
        <li key={search.id} className="grid gap-1 py-2.5">
          <p className="text-sm font-semibold">{searchLabel(search)}</p>
          <SearchResult search={search} />
        </li>
      ))}
    </ul>
  );
}

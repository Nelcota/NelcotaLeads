import type { Search, SearchStatus } from "@/db/schema";

/** The filters of the Buscas list, in the order the pills show them (also the `filter` URL value). */
export const SEARCH_FILTER_IDS = ["all", "running", "done", "failed", "hidden"] as const;

export type SearchFilter = (typeof SEARCH_FILTER_IDS)[number];

export const SEARCH_FILTER_LABELS: Record<SearchFilter, string> = {
  all: "Todas",
  running: "Em andamento",
  done: "Concluídas",
  failed: "Com falha",
  hidden: "Ocultas",
};

/** Collecting on Google or being analyzed by the AI. */
export function isSearchRunning(status: SearchStatus): boolean {
  return status === "collecting" || status === "analyzing";
}

/** "Ocultas" lists only hidden searches; every other filter leaves them out. */
export function matchesSearchFilter(search: Search, filter: SearchFilter): boolean {
  const hidden = search.hiddenAt !== null;
  if (filter === "hidden") return hidden;
  if (hidden) return false;
  if (filter === "running") return isSearchRunning(search.status);
  if (filter === "done") return search.status === "done";
  if (filter === "failed") return search.status === "error";
  return true;
}

export function countSearches(searches: readonly Search[], filter: SearchFilter): number {
  return searches.filter((search) => matchesSearchFilter(search, filter)).length;
}

export type SearchSummary = { searches: number; newLeads: number; running: number };

/** The line next to "Histórico": visible searches, the new leads they brought, how many run. */
export function summarizeSearches(searches: readonly Search[]): SearchSummary {
  const visible = searches.filter((search) => search.hiddenAt === null);
  return {
    searches: visible.length,
    newLeads: visible.reduce((sum, search) => sum + search.foundCount, 0),
    running: visible.filter((search) => isSearchRunning(search.status)).length,
  };
}

export type SearchDetails = {
  foundOnGoogle: number;
  newCompanies: number;
  alreadyKnown: number;
  analyzed: number;
  failed: number;
  requested: number;
};

/** The numbers behind "Ver detalhes da busca", all already stored on the search. */
export function searchDetails(search: Search): SearchDetails {
  return {
    foundOnGoogle: search.foundCount + search.duplicateCount,
    newCompanies: search.foundCount,
    alreadyKnown: search.duplicateCount,
    analyzed: search.analyzedCount,
    failed: search.errorCount,
    requested: search.maxResults,
  };
}

/** Share of the new companies the AI already went through, 0 to 100. */
export function analysisPercent(search: Search): number {
  if (search.foundCount <= 0) return 0;
  const processed = search.analyzedCount + search.errorCount;
  return Math.min(100, Math.round((processed / search.foundCount) * 100));
}

import { BRAZIL_STATES, type BrazilState, type StateCode } from "@/lib/brazil-states";
import { isSearchRunning } from "@/lib/search-list";
import type { SearchWithState } from "@/lib/search-state";

export type StateStats = {
  searches: number;
  newLeads: number;
  /** Visible searches still collecting or analyzing here, newest first. */
  running: SearchWithState[];
};

const isVisible = (search: SearchWithState) => search.hiddenAt === null;

/** What the visible searches did in each state; hidden ones and unplaced ones stay out. */
export function statsByState(searches: readonly SearchWithState[]): Map<StateCode, StateStats> {
  const stats = new Map<StateCode, StateStats>();
  for (const search of searches) {
    if (!isVisible(search) || search.state === null) continue;
    const current = stats.get(search.state) ?? { searches: 0, newLeads: 0, running: [] };
    stats.set(search.state, {
      searches: current.searches + 1,
      newLeads: current.newLeads + search.foundCount,
      running: isSearchRunning(search.status) ? [...current.running, search] : current.running,
    });
  }
  return stats;
}

export type RankedState = { state: BrazilState; stats: StateStats };

/** "Leads novos por estado": the states with a search, most new leads first. */
export function rankStates(stats: ReadonlyMap<StateCode, StateStats>): RankedState[] {
  return BRAZIL_STATES.flatMap((state) => {
    const found = stats.get(state.code);
    return found ? [{ state, stats: found }] : [];
  }).toSorted((a, b) => b.stats.newLeads - a.stats.newLeads || b.stats.searches - a.stats.searches);
}

/** New companies over everything Google returned in finished searches, or null before any. */
export function stateYield(searches: readonly SearchWithState[]): number | null {
  const done = searches.filter((search) => search.status === "done");
  const fresh = done.reduce((sum, search) => sum + search.foundCount, 0);
  const total = done.reduce((sum, search) => sum + search.foundCount + search.duplicateCount, 0);
  if (total === 0) return null;
  return Math.round((fresh / total) * 100);
}

/** "Belo Horizonte · Juiz de Fora (2)": the places being searched, repeats counted once. */
export function runningPlaces(running: readonly SearchWithState[]): string {
  const counts = new Map<string, number>();
  for (const search of running) counts.set(search.city, (counts.get(search.city) ?? 0) + 1);
  return [...counts.entries()]
    .map(([city, count]) => (count > 1 ? `${city} (${count})` : city))
    .join(" · ");
}

export type BrazilSummary = {
  stats: Map<StateCode, StateStats>;
  ranked: RankedState[];
  running: SearchWithState[];
  searches: number;
  newLeads: number;
  /** Visible searches whose state could not be told; counted apart so the totals still add up. */
  unplaced: number;
  /** New leads of the first state, the full length of the ranking bars. */
  topLeads: number;
};

/** The map and the "Brasil" panel: every visible search placed in a state. */
export function summarizeBrazil(searches: readonly SearchWithState[]): BrazilSummary {
  const stats = statsByState(searches);
  const ranked = rankStates(stats);
  return {
    stats,
    ranked,
    running: ranked.flatMap((row) => row.stats.running),
    searches: ranked.reduce((sum, row) => sum + row.stats.searches, 0),
    newLeads: ranked.reduce((sum, row) => sum + row.stats.newLeads, 0),
    unplaced: searches.filter((search) => isVisible(search) && search.state === null).length,
    topLeads: ranked[0]?.stats.newLeads ?? 0,
  };
}

export type StateSummary = {
  searches: number;
  newLeads: number;
  /** See stateYield. */
  yieldPercent: number | null;
  running: SearchWithState[];
  /** The last finished searches, newest first. */
  recent: SearchWithState[];
};

/** Finished searches listed in a state's panel. */
const RECENT_ROWS = 3;

/** One state's panel: its visible searches, what runs there and the last finished ones. */
export function summarizeState(
  searches: readonly SearchWithState[],
  code: StateCode,
): StateSummary {
  const inState = searches.filter((search) => isVisible(search) && search.state === code);
  return {
    searches: inState.length,
    newLeads: inState.reduce((sum, search) => sum + search.foundCount, 0),
    yieldPercent: stateYield(inState),
    running: inState.filter((search) => isSearchRunning(search.status)),
    recent: inState.filter((search) => !isSearchRunning(search.status)).slice(0, RECENT_ROWS),
  };
}

import {
  BRAZIL_STATES,
  REGIONS,
  foldText,
  type BrazilState,
  type StateCode,
} from "@/lib/brazil-states";
import { isSearchRunning } from "@/lib/search-list";
import type { SearchWithState } from "@/lib/search-state";

export type StateStats = {
  searches: number;
  newLeads: number;
  /** Visible searches still collecting or analyzing here, newest first. */
  running: SearchWithState[];
};

/** What the visible searches did in each state; hidden ones and unplaced ones stay out. */
export function statsByState(searches: readonly SearchWithState[]): Map<StateCode, StateStats> {
  const stats = new Map<StateCode, StateStats>();
  for (const search of searches) {
    if (search.hiddenAt !== null || search.state === null) continue;
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

/** Visible searches in a state, newest first as the list already is. */
export function searchesInState(
  searches: readonly SearchWithState[],
  code: StateCode,
): SearchWithState[] {
  return searches.filter((search) => search.hiddenAt === null && search.state === code);
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

const byName = (a: BrazilState, b: BrazilState) => a.name.localeCompare(b.name, "pt-BR");

export type StateGroup = { name: string; states: BrazilState[] };

/**
 * The "Ir para um estado" options: by region while nothing is typed, then one flat list of the
 * states whose name contains the text or whose code is the text, accents ignored.
 */
export function matchStates(text: string): StateGroup[] {
  const term = foldText(text);
  if (term === "") {
    return REGIONS.map((region) => ({
      name: region.name,
      states: BRAZIL_STATES.filter((state) => state.region === region.id).toSorted(byName),
    }));
  }
  const states = BRAZIL_STATES.filter(
    (state) => foldText(state.name).includes(term) || foldText(state.code) === term,
  ).toSorted(byName);
  return states.length > 0 ? [{ name: "", states }] : [];
}

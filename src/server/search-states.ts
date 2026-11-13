import { inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { SCORE_TIERS } from "@/lib/schemas";
import { searchState, type SearchWithState } from "@/lib/search-state";
import { querySearches, SEARCH_LIST_LIMIT, searchListOrder } from "./search-actions";

// Only addresses that end with the state, as Google writes it: "…, Belo Horizonte - MG, …".
const addressWithState = sql<string | null>`min(case
  when ${leads.address} glob '* - [A-Z][A-Z],*' or ${leads.address} glob '* - [A-Z][A-Z]'
  then ${leads.address} end)`;

const highScoreLeads = sql<number>`coalesce(sum(case when ${leads.score} >= ${SCORE_TIERS.high.min} then 1 else 0 end), 0)`;

/**
 * Per listed search, from its leads: one address with a state (every lead of a search comes
 * from one place) and how many leads scored high.
 */
function leadFacts(db: Db, limit: number) {
  const listed = db
    .select({ id: searches.id })
    .from(searches)
    .orderBy(...searchListOrder())
    .limit(limit);
  return db
    .select({ searchId: leads.searchId, address: addressWithState, highScore: highScoreLeads })
    .from(leads)
    .where(inArray(leads.searchId, listed))
    .groupBy(leads.searchId);
}

/**
 * The Buscas list (see querySearches) with the state each search ran in, for the map, and its
 * high-score leads, for the "N com nota alta" link.
 */
export async function querySearchesWithStates(
  db: Db,
  limit = SEARCH_LIST_LIMIT,
): Promise<SearchWithState[]> {
  const [rows, facts] = await Promise.all([querySearches(db, limit), leadFacts(db, limit)]);
  const factsOf = new Map(facts.map((row) => [row.searchId, row]));
  return rows.map((search) => {
    const fact = factsOf.get(search.id);
    return {
      ...search,
      state: searchState(search.city, fact?.address ?? null),
      highScoreCount: fact?.highScore ?? 0,
    };
  });
}

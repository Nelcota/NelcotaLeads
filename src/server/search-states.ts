import { and, inArray, or, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { searchState, type SearchWithState } from "@/lib/search-state";
import { querySearches, SEARCH_LIST_LIMIT, searchListOrder } from "./search-actions";

// Only addresses that end with the state, as Google writes it: "…, Belo Horizonte - MG, …".
const hasState = or(
  sql`${leads.address} glob '* - [A-Z][A-Z],*'`,
  sql`${leads.address} glob '* - [A-Z][A-Z]'`,
);

/** One address with a state per listed search: every lead of a search comes from one place. */
function leadAddresses(db: Db, limit: number) {
  const listed = db
    .select({ id: searches.id })
    .from(searches)
    .orderBy(...searchListOrder())
    .limit(limit);
  return db
    .select({ searchId: leads.searchId, address: sql<string | null>`min(${leads.address})` })
    .from(leads)
    .where(and(inArray(leads.searchId, listed), hasState))
    .groupBy(leads.searchId);
}

/** The Buscas list (see querySearches) with the state each search ran in, for the map. */
export async function querySearchesWithStates(
  db: Db,
  limit = SEARCH_LIST_LIMIT,
): Promise<SearchWithState[]> {
  const [rows, addresses] = await Promise.all([querySearches(db, limit), leadAddresses(db, limit)]);
  const addressOf = new Map(addresses.map((row) => [row.searchId, row.address]));
  return rows.map((search) => ({
    ...search,
    state: searchState(search.city, addressOf.get(search.id) ?? null),
  }));
}

import { desc, inArray, isNotNull, and, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, searches } from "@/db/schema";
import { searchState, type SearchWithState } from "@/lib/search-state";
import { querySearches, SEARCH_LIST_LIMIT } from "./search-actions";

/** One lead address per listed search: every lead of a search comes from the same place. */
function leadAddresses(db: Db, limit: number) {
  const listed = db
    .select({ id: searches.id })
    .from(searches)
    .orderBy(sql`${searches.hiddenAt} is not null`, desc(searches.createdAt))
    .limit(limit);
  return db
    .select({ searchId: leads.searchId, address: sql<string | null>`min(${leads.address})` })
    .from(leads)
    .where(and(inArray(leads.searchId, listed), isNotNull(leads.address)))
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

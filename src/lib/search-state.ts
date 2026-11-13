import { BRAZIL_STATES, foldText, isStateCode, type StateCode } from "@/lib/brazil-states";
import type { Search } from "@/db/schema";

// Google writes the state after the city: "…, Belo Horizonte - MG, 30130-005, Brasil".
const ADDRESS_STATE = /\s-\s([A-Z]{2})(?=,|$)/g;

/** The state in an address Google returned, or null when it has none. */
export function stateFromAddress(address: string | null): StateCode | null {
  if (!address) return null;
  const codes = [...address.matchAll(ADDRESS_STATE)]
    .map((match) => match[1] ?? "")
    .filter(isStateCode);
  return codes.at(-1) ?? null;
}

function stateFromSegment(segment: string): StateCode | null {
  const upper = segment.trim().toUpperCase();
  if (isStateCode(upper)) return upper;
  const folded = foldText(segment);
  const byName = BRAZIL_STATES.find((state) => foldText(state.name) === folded);
  if (byName) return byName.code;
  const byCapital = BRAZIL_STATES.find((state) => foldText(state.capital) === folded);
  return byCapital?.code ?? null;
}

/**
 * The state of the place typed in a search, read from the end: "Savassi, Belo Horizonte",
 * "Contagem - MG" or "Bahia". Null when no part is a state code, a state name or a capital.
 */
export function stateFromCity(city: string): StateCode | null {
  const segments = city.split(/,|\s-\s|\//).filter((segment) => segment.trim() !== "");
  for (const segment of segments.toReversed()) {
    const state = stateFromSegment(segment);
    if (state) return state;
  }
  return null;
}

/** A search's state: from a lead's address when there is one, else from the typed city. */
export function searchState(city: string, leadAddress: string | null): StateCode | null {
  return stateFromAddress(leadAddress) ?? stateFromCity(city);
}

/** A search of the Buscas list with the state it ran in, when it can be told. */
export type SearchWithState = Search & { state: StateCode | null };

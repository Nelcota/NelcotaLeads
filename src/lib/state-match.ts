import { BRAZIL_STATES, REGIONS, foldText, type BrazilState } from "@/lib/brazil-states";

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

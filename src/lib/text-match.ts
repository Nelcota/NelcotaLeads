/** Lowercase without accents, so "otica" finds "Óticas". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type MatchParts = { before: string; match: string; after: string };

/**
 * The label split around the typed text (accents and case ignored), so the match can be marked.
 * `query` is already folded and trimmed. No match: the whole label sits in `before`.
 */
export function matchParts(label: string, query: string): MatchParts {
  const at = query ? foldText(label).indexOf(query) : -1;
  if (at < 0) return { before: label, match: "", after: "" };
  return {
    before: label.slice(0, at),
    match: label.slice(at, at + query.length),
    after: label.slice(at + query.length),
  };
}

/** The items whose label holds the typed text, in their original order. */
export function filterByLabel<Item extends { label: string }>(
  items: readonly Item[],
  query: string,
): Item[] {
  if (!query) return [...items];
  return items.filter((item) => foldText(item.label).includes(query));
}

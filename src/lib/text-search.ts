/** Lowercase and without accents, so "clinica" finds "Clínica". */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** True when the query is empty or every word of it appears in one of the fields. */
export function matchesQuery(
  fields: readonly (string | null | undefined)[],
  query: string,
): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = foldText(fields.filter(Boolean).join("\n"));
  return words.every((word) => haystack.includes(word));
}

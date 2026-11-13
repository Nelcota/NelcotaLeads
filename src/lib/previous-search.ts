import type { Search } from "@/db/schema";
import { foldText } from "@/lib/brazil-states";
import { dayMonth, formatCount, localDay } from "@/lib/format";
import { isSearchRunning } from "@/lib/search-list";

const same = (a: string, b: string) => foldText(a) === foldText(b);

/**
 * The latest search with the same niche and city (case and accents ignored), hidden ones
 * included: their quota was spent too. Null while either field is empty or nothing matches.
 */
export function findPreviousSearch(
  searches: readonly Search[],
  niche: string,
  city: string,
): Search | null {
  if (niche.trim() === "" || city.trim() === "") return null;
  const matches = searches.filter((search) => same(search.niche, niche) && same(search.city, city));
  const latest = matches.toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  return latest ?? null;
}

function finishedText(search: Search, day: string): string {
  const total = search.foundCount + search.duplicateCount;
  if (total === 0) return `Você buscou isso em ${day} e o Google não trouxe nenhuma empresa.`;
  return `Você buscou isso em ${day}: ${formatCount(search.duplicateCount)} de ${formatCount(total)} já existiam.`;
}

/** What the repeat warning says about the earlier search, by how it ended. */
export function previousSearchText(search: Search): string {
  if (isSearchRunning(search.status)) return "Essa busca já está em andamento.";
  const day = dayMonth(localDay(search.createdAt));
  if (search.status === "error") return `Você tentou isso em ${day} e a busca falhou.`;
  if (search.status === "cancelled") {
    return `Você buscou isso em ${day} e cancelou com ${formatCount(search.foundCount)} novas.`;
  }
  return finishedText(search, day);
}

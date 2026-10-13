/**
 * The fixed "search" that leads added by hand belong to (every lead needs one). Created on the
 * first "Adicionar lead"; kept out of the Buscas list, but filterable in Leads.
 */
export const MANUAL_SEARCH_ID = "manual";
export const MANUAL_SEARCH_NAME = "Adicionados manualmente";

/** How a search is named in filters and lists: "dentistas em Belo Horizonte". */
export function searchLabel(search: { id: string; niche: string; city: string }) {
  return search.id === MANUAL_SEARCH_ID ? MANUAL_SEARCH_NAME : `${search.niche} em ${search.city}`;
}

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { SearchOption } from "@/hooks/use-searchable-list";
import { formatDate } from "@/lib/format";
import { nichesQuery, searchesQuery, teamMembersQuery } from "@/lib/queries";
import { NO_OWNER, type LeadFilters } from "@/lib/schemas";
import { searchLabel } from "@/lib/searches";

export type FilterList = "niche" | "search";

export type OwnerChoice = { key: string; label: string; patch: Partial<LeadFilters> };

const ALL_OWNERS: Partial<LeadFilters> = { mine: undefined, owner: undefined };

/** Searches are often typed in lowercase ("óticas em Contagem"); a row reads as a name. */
function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function leadsLabel(count: number): string {
  return `${count} ${count === 1 ? "lead" : "leads"}`;
}

/** Which Responsável pill the filters match: "all", "mine", "none" or a person's id. */
export function ownerKey(filters: LeadFilters): string {
  if (filters.mine) return "mine";
  if (filters.owner === NO_OWNER) return "none";
  return filters.owner ?? "all";
}

/**
 * The "Filtros" panel's state: which list (Nicho, Busca) is open over the groups, and the
 * options each list and the Responsável pills show.
 */
export function useFiltersPanel() {
  const [list, setList] = useState<FilterList | null>(null);
  // The last list stays mounted while it slides out, so closing animates too.
  const [shownList, setShownList] = useState<FilterList>("niche");
  const { data: niches } = useQuery(nichesQuery);
  const { data: searches } = useQuery(searchesQuery);
  const { data: members } = useQuery(teamMembersQuery);

  const nicheOptions: SearchOption[] = (niches ?? []).map((niche) => ({
    key: niche.key,
    label: niche.label,
    count: leadsLabel(niche.leads),
  }));

  const searchOptions: SearchOption[] = (searches ?? []).map((search) => ({
    key: search.id,
    label: capitalize(searchLabel(search)),
    sub: formatDate(search.createdAt),
    count: leadsLabel(search.foundCount),
  }));

  const owners: OwnerChoice[] = [
    { key: "all", label: "Todos", patch: ALL_OWNERS },
    { key: "mine", label: "Meus leads", patch: { mine: true, owner: undefined } },
    { key: "none", label: "Sem responsável", patch: { mine: undefined, owner: NO_OWNER } },
    ...(members ?? []).map((member) => ({
      key: member.id,
      label: member.name,
      patch: { mine: undefined, owner: member.id },
    })),
  ];

  const openList = (next: FilterList) => {
    setShownList(next);
    setList(next);
  };

  return {
    list,
    shownList,
    openList,
    closeList: () => setList(null),
    nicheOptions,
    searchOptions,
    owners,
  };
}

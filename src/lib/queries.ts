import { queryOptions } from "@tanstack/react-query";
import type { LeadFilters } from "@/lib/schemas";
import { getLead, listLeads } from "@/server/leads";
import { getProviderStatus, getSearch, listSearches } from "@/server/searches";

export const searchesQuery = queryOptions({
  queryKey: ["searches"],
  queryFn: () => listSearches(),
});

export const searchQuery = (id: string) =>
  queryOptions({
    queryKey: ["searches", id],
    queryFn: () => getSearch({ data: { id } }),
    // Poll while the queue is still working on this search.
    refetchInterval: (query) =>
      query.state.data && ["collecting", "analyzing"].includes(query.state.data.status)
        ? 2000
        : false,
  });

export const providerStatusQuery = queryOptions({
  queryKey: ["provider-status"],
  queryFn: () => getProviderStatus(),
  staleTime: Infinity,
});

export const leadsQuery = (filters: LeadFilters) =>
  queryOptions({
    queryKey: ["leads", filters],
    queryFn: () => listLeads({ data: filters }),
    // Keep refreshing while the queue is still analyzing some of the visible leads.
    refetchInterval: (query) =>
      query.state.data?.some((lead) => lead.analysisStatus === "pending") ? 3000 : false,
  });

export const leadQuery = (id: string) =>
  queryOptions({
    queryKey: ["lead", id],
    queryFn: () => getLead({ data: { id } }),
    refetchInterval: (query) =>
      query.state.data?.lead.analysisStatus === "pending" ? 3000 : false,
  });

import { queryOptions } from "@tanstack/react-query";
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

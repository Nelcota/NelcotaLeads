import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Page } from "@/components/app-shell";
import { SearchComposer } from "@/components/searches/search-composer";
import { SearchHistory } from "@/components/searches/search-history";
import { useNewSearch } from "@/hooks/use-new-search";
import { companiesLeftToday } from "@/lib/google-quota";
import { useNotFoundToast } from "@/lib/not-found-toast";
import { pageTitle } from "@/lib/page-title";
import { searchesQuery } from "@/lib/queries";
import { lenientSearch } from "@/lib/schemas";
import { SEARCH_FILTER_IDS, type SearchFilter } from "@/lib/search-list";
import { MANUAL_SEARCH_ID } from "@/lib/searches";

export const Route = createFileRoute("/searches/")({
  head: () => ({ meta: [{ title: pageTitle("Buscas") }] }),
  // `missing`: arrived from a link to a search that no longer exists.
  // `filter`: the Histórico filter, so a filtered list survives a reload or a shared link.
  validateSearch: lenientSearch(
    z.object({ missing: z.boolean().optional(), filter: z.enum(SEARCH_FILTER_IDS).optional() }),
  ),
  loader: ({ context }) => context.queryClient.ensureQueryData(searchesQuery),
  component: SearchesPage,
});

function SearchesPage() {
  const { data: all } = useSuspenseQuery(searchesQuery);
  const { missing, filter = "all" } = Route.useSearch();
  const navigate = useNavigate({ from: "/searches/" });
  useNotFoundToast(
    missing,
    "Busca não encontrada",
    () => void navigate({ search: (prev) => ({ ...prev, missing: undefined }), replace: true }),
  );
  const newSearch = useNewSearch();
  const quotaSpent = newSearch.usage ? companiesLeftToday(newSearch.usage) === 0 : false;
  // Leads added by hand are filed under a fixed "search" that is not one (see Leads).
  const searches = all.filter((search) => search.id !== MANUAL_SEARCH_ID);
  const setFilter = (next: SearchFilter) =>
    void navigate({
      search: (prev) => ({ ...prev, filter: next === "all" ? undefined : next }),
      replace: true,
    });

  return (
    <Page
      title="Buscas"
      description="Empresas do Google Maps por nicho e cidade. A IA avalia cada uma e as boas viram leads."
    >
      <SearchComposer newSearch={newSearch} />
      <SearchHistory
        searches={searches}
        filter={filter}
        onFilterChange={setFilter}
        quotaSpent={quotaSpent}
        onFill={newSearch.prefill}
      />
    </Page>
  );
}

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Page, Stat } from "@/components/app-shell";
import { SearchMap } from "@/components/searches/map/search-map";
import { SearchComposer } from "@/components/searches/search-composer";
import { SearchHistory } from "@/components/searches/search-history";
import { useNewSearch } from "@/hooks/use-new-search";
import { STATE_CODES, stateByCode, type StateCode } from "@/lib/brazil-states";
import { companiesLeftToday } from "@/lib/google-quota";
import { useNotFoundToast } from "@/lib/not-found-toast";
import { pageTitle } from "@/lib/page-title";
import { searchesQuery } from "@/lib/queries";
import { lenientSearch } from "@/lib/schemas";
import { SEARCH_FILTER_IDS, summarizeSearches, type SearchFilter } from "@/lib/search-list";
import { MANUAL_SEARCH_ID } from "@/lib/searches";

export const Route = createFileRoute("/searches/")({
  head: () => ({ meta: [{ title: pageTitle("Buscas") }] }),
  // `missing`: arrived from a link to a search that no longer exists.
  // `filter`: the Histórico filter, so a filtered list survives a reload or a shared link.
  // `uf`: the state chosen on the map; the Histórico shows only its searches.
  validateSearch: lenientSearch(
    z.object({
      missing: z.boolean().optional(),
      filter: z.enum(SEARCH_FILTER_IDS).optional(),
      uf: z.enum(STATE_CODES).optional(),
    }),
  ),
  loader: ({ context }) => context.queryClient.ensureQueryData(searchesQuery),
  component: SearchesPage,
});

function SearchesPage() {
  const { data: all } = useSuspenseQuery(searchesQuery);
  const { missing, filter = "all", uf } = Route.useSearch();
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
  const summary = summarizeSearches(searches);
  const setFilter = (next: SearchFilter) =>
    void navigate({
      search: (prev) => ({ ...prev, filter: next === "all" ? undefined : next }),
      replace: true,
    });
  const chooseState = (next: StateCode | undefined) =>
    void navigate({ search: (prev) => ({ ...prev, uf: next }), replace: true });
  const inState = uf ? searches.filter((search) => search.state === uf) : searches;
  // "Ver no Histórico": the running filter, and the list brought into view.
  const showRunning = () => {
    setFilter("running");
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById("historico")
      ?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  };

  return (
    <Page
      title="Buscas"
      description={
        summary.searches > 0 ? (
          <>
            <Stat value={summary.searches} one="busca">
              buscas
            </Stat>
            {" · "}
            <Stat value={summary.newLeads} one="lead novo">
              leads novos
            </Stat>
            {summary.running > 0 ? (
              <>
                {" · "}
                <Stat value={summary.running}>em andamento</Stat>
              </>
            ) : null}
          </>
        ) : (
          "Empresas do Google Maps por nicho e cidade. A IA avalia cada uma e as boas viram leads."
        )
      }
    >
      <SearchComposer newSearch={newSearch} />
      {summary.searches > 0 ? (
        <SearchMap
          searches={searches}
          chosen={uf}
          quotaSpent={quotaSpent}
          onChoose={chooseState}
          onShowRunning={showRunning}
          onSearchIn={(city) => newSearch.prefill(newSearch.form.getValues("niche"), city)}
        />
      ) : null}
      <SearchHistory
        searches={inState}
        filter={filter}
        onFilterChange={setFilter}
        quotaSpent={quotaSpent}
        onFill={newSearch.prefill}
        place={uf ? { name: stateByCode(uf).name, onClear: () => chooseState(undefined) } : null}
      />
    </Page>
  );
}

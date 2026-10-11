import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, PageHeader, useOpenNewSearch } from "@/components/app-shell";
import { SearchStatusBadge } from "@/components/search-status";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { Search } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { searchesQuery } from "@/lib/queries";

export const Route = createFileRoute("/searches/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(searchesQuery),
  component: SearchesPage,
});

function SearchesPage() {
  const { data } = useSuspenseQuery(searchesQuery);
  const openNewSearch = useOpenNewSearch();
  return (
    <Page>
      <PageHeader title="Buscas" />
      {data.length === 0 ? (
        <div className="grid justify-items-center gap-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma busca ainda.</p>
          <Button onClick={openNewSearch}>Nova busca</Button>
        </div>
      ) : (
        <ul className="divide-y border-y">
          {data.map((search) => (
            <SearchRow key={search.id} search={search} />
          ))}
        </ul>
      )}
    </Page>
  );
}

function SearchRow({ search }: { search: Search }) {
  const processed = search.analyzedCount + search.errorCount;
  const running = search.status === "collecting" || search.status === "analyzing";
  const facts = [
    `${search.foundCount} ${search.foundCount === 1 ? "lead novo" : "leads novos"}`,
    search.duplicateCount > 0 ? `${search.duplicateCount} já existiam` : null,
    `${search.placesRequests} ${search.placesRequests === 1 ? "requisição" : "requisições"}`,
    formatDate(search.createdAt, true),
  ].filter(Boolean);

  return (
    <li className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="min-w-0">
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-medium">
            {search.niche} em {search.city}
          </span>
          <SearchStatusBadge status={search.status} errors={search.errorCount} />
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{facts.join(" · ")}</p>
        {running ? (
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <Progress
              className="max-w-64"
              value={
                search.status === "collecting" || search.foundCount === 0
                  ? 5
                  : (processed / search.foundCount) * 100
              }
              aria-label="Progresso da análise"
            />
            <span className="tabular-nums">
              {processed} de {search.foundCount}
            </span>
          </div>
        ) : null}
        {search.errorMessage ? (
          <p className="mt-2 text-sm text-destructive">{search.errorMessage}</p>
        ) : null}
      </div>
      {search.foundCount > 0 ? (
        <Button asChild variant="outline" size="sm" className="justify-self-start">
          <Link to="/" search={{ view: "all", searchId: search.id }}>
            Ver leads
          </Link>
        </Button>
      ) : null}
    </li>
  );
}

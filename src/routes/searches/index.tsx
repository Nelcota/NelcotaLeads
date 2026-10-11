import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { SearchStatusBadge } from "@/components/search-status";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { searchesQuery } from "@/lib/queries";

export const Route = createFileRoute("/searches/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(searchesQuery),
  component: SearchesPage,
});

function SearchesPage() {
  const { data } = useSuspenseQuery(searchesQuery);
  return (
    <>
      <PageHeader title="Buscas" />
      {data.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-medium">Nenhuma busca ainda</p>
          <Button asChild className="mt-5">
            <Link to="/searches/new">Nova busca</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y border-y">
          {data.map((search) => {
            const processed = search.analyzedCount + search.errorCount;
            const running = search.status === "collecting" || search.status === "analyzing";
            return (
              <li key={search.id}>
                <Link
                  to="/searches/$searchId"
                  params={{ searchId: search.id }}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4 transition-colors hover:bg-muted/40 sm:px-3"
                >
                  <span className="font-medium">
                    {search.niche} em {search.city}
                  </span>
                  <span className="flex items-baseline gap-4 text-sm text-muted-foreground">
                    <span className="tabular-nums">
                      {running
                        ? `${processed} de ${search.foundCount}`
                        : `${search.foundCount} ${search.foundCount === 1 ? "lead" : "leads"}`}
                    </span>
                    <SearchStatusBadge status={search.status} errors={search.errorCount} />
                    <span className="hidden whitespace-nowrap sm:inline">
                      {formatDate(search.createdAt, true)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

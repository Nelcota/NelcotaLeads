import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
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
      <PageHeader
        title="Buscas"
        description="Cada busca coleta empresas de um nicho em uma cidade e manda todas para a IA analisar."
        actions={
          <Button asChild>
            <Link to="/searches/new">
              <PlusIcon /> Nova busca
            </Link>
          </Button>
        }
      />
      {data.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
          <p className="font-medium">Nenhuma busca ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece escolhendo um nicho e uma cidade.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {data.map((search) => {
            const processed = search.analyzedCount + search.errorCount;
            const running = search.status === "collecting" || search.status === "analyzing";
            const percent =
              search.foundCount > 0 ? Math.round((processed / search.foundCount) * 100) : 0;
            return (
              <li key={search.id}>
                <Link
                  to="/searches/$searchId"
                  params={{ searchId: search.id }}
                  className="group flex items-center gap-4 rounded-xl border bg-card px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-medium">
                        {search.niche}
                        <span className="font-normal text-muted-foreground"> em {search.city}</span>
                      </p>
                      <SearchStatusBadge status={search.status} errors={search.errorCount} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {search.foundCount} {search.foundCount === 1 ? "lead novo" : "leads novos"}
                      {search.duplicateCount > 0 ? ` · ${search.duplicateCount} já existiam` : ""}
                      {` · ${formatDate(search.createdAt, true)}`}
                    </p>
                    {running ? (
                      <div className="mt-3 h-1 max-w-sm overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground transition-[width] duration-500"
                          style={{ width: `${Math.max(4, percent)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

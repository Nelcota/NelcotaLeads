import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { ScoreBadge } from "@/components/lead-badges";
import { SearchStatusBadge } from "@/components/search-status";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/format";
import { leadsQuery, searchQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/searches/$searchId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(searchQuery(params.searchId)),
  component: SearchPage,
});

function SearchPage() {
  const { searchId } = Route.useParams();
  const { data: search } = useSuspenseQuery(searchQuery(searchId));
  const { data: searchLeads } = useQuery(leadsQuery({ searchId }));
  const processed = search.analyzedCount + search.errorCount;
  const percent = search.foundCount > 0 ? Math.round((processed / search.foundCount) * 100) : 100;
  const running = search.status === "collecting" || search.status === "analyzing";

  const facts = [
    `${search.foundCount} ${search.foundCount === 1 ? "lead novo" : "leads novos"}`,
    search.duplicateCount > 0 ? `${search.duplicateCount} já existiam` : null,
    `${search.placesRequests} ${search.placesRequests === 1 ? "requisição" : "requisições"} ao Google`,
    formatDate(search.createdAt, true),
  ].filter(Boolean);

  return (
    <>
      <Link
        to="/searches"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        Buscas
      </Link>
      <PageHeader title={`${search.niche} em ${search.city}`} description={facts.join(" · ")} />

      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-4 text-sm">
          <SearchStatusBadge status={search.status} errors={search.errorCount} />
          {running ? (
            <span className="text-muted-foreground tabular-nums">
              {search.status === "collecting"
                ? "Coletando no Google"
                : `${processed} de ${search.foundCount} analisados`}
            </span>
          ) : null}
        </div>
        {running ? (
          <Progress
            value={search.status === "collecting" ? 5 : percent}
            aria-label="Progresso da análise"
          />
        ) : null}
        {search.errorMessage ? (
          <p
            role="alert"
            className={cn(
              "text-sm",
              search.status === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {search.errorMessage}
          </p>
        ) : null}
      </div>

      {searchLeads && searchLeads.length > 0 ? (
        <ul className="mt-8 divide-y border-y">
          {searchLeads.map((lead) => (
            <li key={lead.id}>
              <Link
                to="/"
                search={{ searchId, lead: lead.id }}
                className="flex items-center justify-between gap-4 py-3 transition-colors hover:bg-muted/40 sm:px-3"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{lead.name}</span>
                  {lead.summary ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {lead.summary}
                    </span>
                  ) : null}
                </span>
                {lead.analysisStatus === "error" ? (
                  <span className="shrink-0 text-xs text-destructive">falhou</span>
                ) : (
                  <ScoreBadge score={lead.score} pending={lead.analysisStatus === "pending"} />
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

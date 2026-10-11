import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { ScoreBadge } from "@/components/lead-badges";
import { SearchStatusBadge } from "@/components/search-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  return (
    <>
      <Link
        to="/searches"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Buscas
      </Link>
      <PageHeader
        title={`${search.niche} em ${search.city}`}
        description={`Até ${search.maxResults} resultados · ${search.placesRequests} ${search.placesRequests === 1 ? "requisição" : "requisições"} ao Google · ${formatDate(search.createdAt, true)}`}
        actions={
          search.foundCount > 0 ? (
            <Button asChild variant="outline">
              <Link to="/" search={{ searchId }}>
                Ver na lista de leads
              </Link>
            </Button>
          ) : null
        }
      />

      <Card>
        <CardContent className="grid gap-6">
          <div className="flex items-center justify-between gap-4">
            <SearchStatusBadge status={search.status} errors={search.errorCount} />
            <span className="text-sm text-muted-foreground tabular-nums">
              {search.status === "collecting"
                ? "Coletando empresas no Google…"
                : `${processed} de ${search.foundCount} processados`}
            </span>
          </div>
          <Progress
            value={search.status === "collecting" ? 5 : percent}
            aria-label="Progresso da análise"
            className={cn(!running && "opacity-60")}
          />
          <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <Stat label="Novos leads" value={search.foundCount} />
            <Stat label="Já existentes" value={search.duplicateCount} hint="ignorados" />
            <Stat label="Analisados" value={search.analyzedCount} />
            <Stat label="Com erro" value={search.errorCount} />
          </dl>
          {search.errorMessage ? (
            <p
              role="alert"
              className={cn(
                "rounded-lg px-4 py-3 text-sm",
                search.status === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/15 text-foreground",
              )}
            >
              {search.errorMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {searchLeads && searchLeads.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Leads desta busca</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {searchLeads.map((lead) => (
              <li
                key={lead.id}
                className="relative flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <Link
                    to="/leads/$leadId"
                    params={{ leadId: lead.id }}
                    className="block truncate text-sm font-medium after:absolute after:inset-0"
                  >
                    {lead.name}
                  </Link>
                  {lead.summary ? (
                    <p className="truncate text-xs text-muted-foreground">{lead.summary}</p>
                  ) : null}
                </div>
                {lead.analysisStatus === "error" ? (
                  <span className="shrink-0 text-xs text-destructive">Falha na análise</span>
                ) : (
                  <ScoreBadge score={lead.score} pending={lead.analysisStatus === "pending"} />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-[28px] leading-none font-light tabular-nums">
        {value}
        {hint && value > 0 ? (
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </dd>
    </div>
  );
}

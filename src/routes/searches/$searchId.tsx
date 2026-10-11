import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { ScoreBadge } from "@/components/lead-badges";
import { SearchStatusBadge } from "@/components/search-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { leadsQuery, searchQuery } from "@/lib/queries";

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

  return (
    <>
      <PageHeader
        title={`${search.niche} em ${search.city}`}
        description={`Até ${search.maxResults} resultados`}
        actions={
          <Button asChild variant="outline">
            <Link to="/" search={{ searchId }}>
              Ver leads
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="grid gap-6">
          <div className="flex items-center justify-between">
            <SearchStatusBadge status={search.status} errors={search.errorCount} />
            <span className="text-sm tabular-nums text-muted-foreground">{percent}%</span>
          </div>
          <Progress value={search.status === "collecting" ? 5 : percent} />
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Novos leads" value={search.foundCount} />
            <Stat label="Já existentes" value={search.duplicateCount} />
            <Stat label="Analisados" value={search.analyzedCount} />
            <Stat label="Com erro" value={search.errorCount} />
          </dl>
          {search.errorMessage ? (
            <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {search.errorMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>
      {searchLeads && searchLeads.length > 0 ? (
        <ul className="mt-6 divide-y rounded-xl border">
          {searchLeads.map((lead) => (
            <li key={lead.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <Link
                to="/leads/$leadId"
                params={{ leadId: lead.id }}
                className="min-w-0 truncate text-sm hover:underline"
              >
                {lead.name}
              </Link>
              {lead.analysisStatus === "error" ? (
                <span className="text-xs text-destructive">erro na análise</span>
              ) : (
                <ScoreBadge score={lead.score} pending={lead.analysisStatus === "pending"} />
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs font-light text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-light tabular-nums">{value}</dd>
    </div>
  );
}

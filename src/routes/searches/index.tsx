import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { SearchStatusBadge } from "@/components/search-status";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        description="Cada busca coleta empresas de um nicho em uma cidade e envia todas para análise."
      />
      {data.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="font-medium">Nenhuma busca ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece escolhendo um nicho e uma cidade.
          </p>
          <Button asChild size="sm" className="mt-5">
            <Link to="/searches/new">Nova busca</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 [&>th]:h-10 [&>th]:text-xs [&>th]:font-medium [&>th]:text-muted-foreground">
                <TableHead>Busca</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Leads analisados</TableHead>
                <TableHead className="hidden text-right md:table-cell">Já existentes</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((search) => (
                <TableRow key={search.id} className="relative">
                  <TableCell className="py-3">
                    <Link
                      to="/searches/$searchId"
                      params={{ searchId: search.id }}
                      className="font-medium after:absolute after:inset-0 hover:underline"
                    >
                      {search.niche}
                    </Link>
                    <span className="text-muted-foreground"> em {search.city}</span>
                  </TableCell>
                  <TableCell>
                    <SearchStatusBadge status={search.status} errors={search.errorCount} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {search.analyzedCount}
                    <span className="text-muted-foreground"> / {search.foundCount}</span>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                    {search.duplicateCount}
                  </TableCell>
                  <TableCell className="hidden text-right whitespace-nowrap text-muted-foreground sm:table-cell">
                    {formatDate(search.createdAt, true)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { searchesQuery } from "@/lib/queries";

export const Route = createFileRoute("/searches/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(searchesQuery),
  component: SearchesPage,
});

function SearchesPage() {
  const { data } = useSuspenseQuery(searchesQuery);
  return (
    <>
      <PageHeader title="Buscas" description="Histórico de coletas e o andamento da análise." />
      {data.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-light text-muted-foreground">Nenhuma busca ainda.</p>
          <Button asChild className="mt-4">
            <Link to="/searches/new">Fazer a primeira busca</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Busca</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Novos leads</TableHead>
                <TableHead className="text-right">Analisados</TableHead>
                <TableHead className="text-right">Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((search) => (
                <TableRow key={search.id}>
                  <TableCell>
                    <Link
                      to="/searches/$searchId"
                      params={{ searchId: search.id }}
                      className="font-medium hover:underline"
                    >
                      {search.niche}
                    </Link>
                    <span className="font-light text-muted-foreground"> em {search.city}</span>
                  </TableCell>
                  <TableCell>
                    <SearchStatusBadge status={search.status} errors={search.errorCount} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{search.foundCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {search.analyzedCount}/{search.foundCount}
                  </TableCell>
                  <TableCell className="text-right font-light text-muted-foreground">
                    {formatDistanceToNow(search.createdAt, { addSuffix: true, locale: ptBR })}
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

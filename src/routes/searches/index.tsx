import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Page, useOpenNewSearch } from "@/components/app-shell";
import { SearchStatusBadge } from "@/components/lead-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <Page
      title="Buscas"
      actions={
        <Button variant="outline" size="sm" onClick={openNewSearch}>
          Busca manual
        </Button>
      }
    >
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Busca</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Leads novos</TableHead>
              <TableHead className="hidden text-right md:table-cell">Requisições</TableHead>
              <TableHead className="hidden md:table-cell">Data</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Nenhuma busca ainda. O piloto automático e a busca manual aparecem aqui.
                </TableCell>
              </TableRow>
            ) : (
              data.map((search) => <SearchRow key={search.id} search={search} />)
            )}
          </TableBody>
        </Table>
      </div>
    </Page>
  );
}

function SearchRow({ search }: { search: Search }) {
  const processed = search.analyzedCount + search.errorCount;
  const running = search.status === "collecting" || search.status === "analyzing";
  return (
    <TableRow>
      <TableCell className="max-w-72">
        <p className="truncate font-medium">
          {search.niche} em {search.city}
        </p>
        {running ? (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Progress
              className="w-32"
              value={search.foundCount > 0 ? (processed / search.foundCount) * 100 : 5}
              aria-label="Progresso da análise"
            />
            {processed} de {search.foundCount}
          </div>
        ) : null}
        {search.errorMessage ? (
          <p className="mt-1 text-xs whitespace-normal text-destructive">{search.errorMessage}</p>
        ) : null}
      </TableCell>
      <TableCell>
        <Badge variant="outline">{search.origin === "autopilot" ? "Automática" : "Manual"}</Badge>
      </TableCell>
      <TableCell>
        <SearchStatusBadge status={search.status} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {search.foundCount}
        {search.duplicateCount > 0 ? (
          <span className="block text-xs text-muted-foreground">
            {search.duplicateCount} já existiam
          </span>
        ) : null}
      </TableCell>
      <TableCell className="hidden text-right tabular-nums md:table-cell">
        {search.placesRequests}
      </TableCell>
      <TableCell className="hidden whitespace-nowrap md:table-cell">
        {formatDate(search.createdAt, true)}
      </TableCell>
      <TableCell className="text-right">
        {search.foundCount > 0 ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/leads" search={{ view: "all", searchId: search.id }}>
              Ver leads
            </Link>
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

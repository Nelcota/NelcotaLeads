import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DownloadIcon,
  GlobeIcon,
  SearchIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { LeadStatusBadge, ScoreBadge } from "@/components/lead-badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { leadsQuery } from "@/lib/queries";
import {
  LEAD_SORT_FIELDS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  leadFiltersSchema,
  type LeadFilters,
} from "@/lib/schemas";
import type { LeadRow } from "@/server/leads-query";

export const Route = createFileRoute("/")({
  validateSearch: leadFiltersSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(leadsQuery(deps)),
  component: LeadsPage,
});

const features = tableFeatures({ rowSortingFeature });
const helper = createColumnHelper<typeof features, LeadRow>();
const EMPTY: LeadRow[] = [];

const columns = helper.columns([
  helper.accessor("name", {
    header: "Empresa",
    sortDescFirst: false,
    cell: ({ row }) => (
      <div className="max-w-64 min-w-40">
        <Link
          to="/leads/$leadId"
          params={{ leadId: row.original.id }}
          className="font-medium hover:underline"
        >
          {row.original.name}
        </Link>
        {row.original.summary ? (
          <p className="mt-0.5 truncate text-xs font-light text-muted-foreground">
            {row.original.summary}
          </p>
        ) : null}
      </div>
    ),
  }),
  helper.accessor("city", {
    header: "Cidade",
    enableSorting: false,
    cell: ({ getValue }) => <span className="font-light">{getValue() ?? "—"}</span>,
  }),
  helper.accessor("score", {
    header: "Nota",
    cell: ({ row }) => (
      <ScoreBadge score={row.original.score} pending={row.original.analysisStatus === "pending"} />
    ),
  }),
  helper.accessor("phone", {
    header: "Telefone",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap font-light tabular-nums">{getValue() ?? "—"}</span>
    ),
  }),
  helper.accessor("website", {
    header: "Site",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.website ? (
        <a
          href={row.original.website}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          title={row.original.website}
        >
          <GlobeIcon className="size-3.5" />
          <span className="max-w-28 truncate font-light">{hostOf(row.original.website)}</span>
        </a>
      ) : (
        <span className="text-xs font-light text-muted-foreground">sem site</span>
      ),
  }),
  helper.accessor("reviewCount", {
    header: "Avaliações",
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 whitespace-nowrap font-light tabular-nums">
        {row.original.rating !== null ? (
          <>
            <StarIcon className="size-3.5 fill-warning text-warning" />
            {row.original.rating.toFixed(1)}
          </>
        ) : null}
        <span className="text-muted-foreground">({row.original.reviewCount ?? 0})</span>
      </span>
    ),
  }),
  helper.accessor("status", {
    header: "Status",
    enableSorting: false,
    cell: ({ getValue }) => <LeadStatusBadge status={getValue()} />,
  }),
  helper.accessor("createdAt", {
    header: "Data",
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap font-light text-muted-foreground">
        {formatDate(getValue())}
      </span>
    ),
  }),
]);

function LeadsPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { data, isFetching } = useQuery(leadsQuery(filters));
  const setFilters = (patch: Partial<LeadFilters>) =>
    navigate({ search: (prev) => clean({ ...prev, ...patch }), replace: true });

  const sorting: SortingState = [
    { id: filters.sort ?? "score", desc: (filters.dir ?? "desc") === "desc" },
  ];
  const table = useTable({
    features,
    columns,
    data: data ?? EMPTY,
    manualSorting: true,
    sortDescFirst: true,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      const sort = LEAD_SORT_FIELDS.find((field) => field === first?.id);
      if (sort) void setFilters({ sort, dir: first?.desc ? "desc" : "asc" });
    },
  });

  const exportHref = `/api/leads.csv?${new URLSearchParams(
    Object.entries(clean(filters)).map(([key, value]) => [key, String(value)]),
  ).toString()}`;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Qualificados por IA e ordenados por nota. O contato é sempre feito por você."
        actions={
          <Button asChild variant="outline">
            <a href={exportHref} download>
              <DownloadIcon /> Exportar CSV
            </a>
          </Button>
        }
      />

      <Filters filters={filters} onChange={(patch) => void setFilters(patch)} />

      <div className="mt-4 overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead key={header.id} className="font-medium">
                      {canSort ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "desc" ? (
                            <ArrowDownIcon className="size-3.5" />
                          ) : sorted === "asc" ? (
                            <ArrowUpIcon className="size-3.5" />
                          ) : null}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {data === undefined ? (
              <LoadingRows />
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="py-16 text-center">
                  <p className="font-light text-muted-foreground">Nenhum lead encontrado.</p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/searches/new">Fazer uma busca</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs font-light text-muted-foreground">
        {data ? `${data.length} lead${data.length === 1 ? "" : "s"}` : ""}
        {isFetching ? " · atualizando…" : ""}
      </p>
    </>
  );
}

function Filters({
  filters,
  onChange,
}: {
  filters: LeadFilters;
  onChange: (patch: Partial<LeadFilters>) => void;
}) {
  const [q, setQ] = useState(filters.q ?? "");
  // Debounce free-text search so each keystroke does not hit the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((filters.q ?? "") !== q) onChange({ q: q || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [q, filters.q, onChange]);

  const hasFilters = Object.keys(clean({ ...filters, sort: undefined, dir: undefined })).length > 0;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative w-full sm:w-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar por nome"
          placeholder="Buscar por nome"
          className="pl-8"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>
      <Select
        value={filters.status ?? "all"}
        onValueChange={(value) =>
          onChange({
            status: LEAD_STATUS_VALUES.find((status) => status === value),
          })
        }
      >
        <SelectTrigger className="w-40" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          {LEAD_STATUS_VALUES.map((status) => (
            <SelectItem key={status} value={status}>
              {LEAD_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5">
        <Input
          aria-label="Nota mínima"
          type="number"
          min={0}
          max={100}
          placeholder="Nota mín."
          className="w-24"
          defaultValue={filters.minScore}
          onBlur={(event) => onChange({ minScore: toScore(event.target.value) })}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          aria-label="Nota máxima"
          type="number"
          min={0}
          max={100}
          placeholder="Nota máx."
          className="w-24"
          defaultValue={filters.maxScore}
          onBlur={(event) => onChange({ maxScore: toScore(event.target.value) })}
        />
      </div>
      <Label className="flex h-9 items-center gap-2 font-light">
        <Checkbox
          checked={filters.noWebsite ?? false}
          onCheckedChange={(checked) => onChange({ noWebsite: checked === true || undefined })}
        />
        Sem site
      </Label>
      {filters.searchId ? (
        <Button variant="secondary" size="sm" onClick={() => onChange({ searchId: undefined })}>
          Apenas uma busca <XIcon />
        </Button>
      ) : null}
      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            onChange({
              q: undefined,
              status: undefined,
              minScore: undefined,
              maxScore: undefined,
              noWebsite: undefined,
              searchId: undefined,
            });
          }}
        >
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}

function LoadingRows() {
  return Array.from({ length: 5 }, (_, i) => (
    <TableRow key={i}>
      <TableCell colSpan={columns.length}>
        <Skeleton className="h-6 w-full" />
      </TableCell>
    </TableRow>
  ));
}

function clean(filters: LeadFilters): LeadFilters {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== undefined && value !== "" && value !== false,
    ),
  );
}

function toScore(value: string) {
  if (value.trim() === "") return undefined;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : undefined;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

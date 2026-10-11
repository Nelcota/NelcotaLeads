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
import { useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
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

/** Columns that collapse on smaller screens; name, score and status always stay. */
const RESPONSIVE: Record<string, string> = {
  city: "hidden lg:table-cell",
  phone: "hidden md:table-cell",
  website: "hidden xl:table-cell",
  reviewCount: "hidden md:table-cell",
  createdAt: "hidden xl:table-cell",
};

const columns = helper.columns([
  helper.accessor("name", {
    header: "Empresa",
    sortDescFirst: false,
    cell: ({ row }) => (
      <div className="max-w-72 min-w-44">
        {/* The ::after overlay makes the whole row clickable. */}
        <Link
          to="/leads/$leadId"
          params={{ leadId: row.original.id }}
          title={row.original.name}
          className="block truncate font-medium after:absolute after:inset-0 hover:underline"
        >
          {row.original.name}
        </Link>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {row.original.summary ??
            (row.original.analysisStatus === "error" ? "Falha na análise" : "Aguardando análise")}
        </p>
      </div>
    ),
  }),
  helper.accessor("score", {
    header: "Nota",
    cell: ({ row }) => (
      <ScoreBadge score={row.original.score} pending={row.original.analysisStatus === "pending"} />
    ),
  }),
  helper.accessor("city", {
    header: "Cidade",
    enableSorting: false,
    cell: ({ getValue }) => getValue() ?? "—",
  }),
  helper.accessor("phone", {
    header: "Telefone",
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap tabular-nums">{getValue() ?? "—"}</span>
    ),
  }),
  helper.accessor("website", {
    header: "Site",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.website ? (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <GlobeIcon className="size-3.5 shrink-0" />
          <span className="max-w-36 truncate">{hostOf(row.original.website)}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">Sem site</span>
      ),
  }),
  helper.accessor("reviewCount", {
    header: "Avaliações",
    cell: ({ row }) =>
      row.original.rating !== null ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
          <StarIcon className="size-3.5 fill-warning text-warning" />
          {row.original.rating.toFixed(1)}
          <span className="text-muted-foreground">({row.original.reviewCount ?? 0})</span>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  }),
  helper.accessor("status", {
    header: "Status",
    enableSorting: false,
    cell: ({ getValue }) => <LeadStatusBadge status={getValue()} />,
  }),
  helper.accessor("createdAt", {
    header: "Coletado",
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap text-muted-foreground">{formatDate(getValue())}</span>
    ),
  }),
]);

const NO_FILTERS: Partial<LeadFilters> = {
  q: undefined,
  status: undefined,
  minScore: undefined,
  maxScore: undefined,
  noWebsite: undefined,
  searchId: undefined,
};

function LeadsPage() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { data, isFetching } = useQuery(leadsQuery(filters));
  const setFilters = (patch: Partial<LeadFilters>) =>
    navigate({ search: (prev) => clean({ ...prev, ...patch }), replace: true });
  const filtered = hasFilters(filters);

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
  const count = data?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Leads"
        description="Empresas qualificadas pela IA, da maior para a menor nota. O contato é sempre feito por você."
        actions={
          count > 0 ? (
            <Button asChild variant="outline">
              <a href={exportHref} download>
                <DownloadIcon /> Exportar CSV
              </a>
            </Button>
          ) : null
        }
      />

      <Filters filters={filters} onChange={(patch) => void setFilters(patch)} />

      <div className="mt-5 overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="bg-muted/40 hover:bg-muted/40">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      className={cn(
                        "h-10 text-xs font-medium text-muted-foreground",
                        RESPONSIVE[header.column.id],
                      )}
                    >
                      {header.column.getCanSort() ? (
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                            sorted && "text-foreground",
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "desc" ? (
                            <ArrowDownIcon className="size-3" />
                          ) : sorted === "asc" ? (
                            <ArrowUpIcon className="size-3" />
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
            ) : count === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="py-20 text-center whitespace-normal">
                  {filtered ? (
                    <>
                      <p className="font-medium">Nenhum lead com esses filtros</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => void setFilters(NO_FILTERS)}
                      >
                        Limpar filtros
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="font-medium">Nenhum lead ainda</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Faça uma busca por nicho e cidade para começar.
                      </p>
                      <Button asChild size="sm" className="mt-5">
                        <Link to="/searches/new">Nova busca</Link>
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="relative">
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className={cn("py-3", RESPONSIVE[cell.column.id])}>
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {data ? `${count} ${count === 1 ? "lead" : "leads"}` : ""}
        {isFetching && data ? " · atualizando…" : ""}
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
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Keep the box in sync when filters are cleared elsewhere (state adjusted during render).
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setQ(filters.q ?? "");
  }

  // Debounce free-text search so each keystroke does not hit the server.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((filters.q ?? "") !== q) onChangeRef.current({ q: q || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [q, filters.q]);

  const statusLabel = filters.status ? LEAD_STATUS_LABELS[filters.status] : "Todos os status";

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="relative w-full sm:w-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
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
          onChange({ status: LEAD_STATUS_VALUES.find((status) => status === value) })
        }
      >
        <SelectTrigger className="w-40" aria-label="Status">
          <SelectValue>{statusLabel}</SelectValue>
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
        <ScoreInput
          label="Nota mínima"
          placeholder="Nota mín."
          value={filters.minScore}
          onCommit={(minScore) => onChange({ minScore })}
        />
        <span className="text-muted-foreground">–</span>
        <ScoreInput
          label="Nota máxima"
          placeholder="Nota máx."
          value={filters.maxScore}
          onCommit={(maxScore) => onChange({ maxScore })}
        />
      </div>
      <Label className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 font-normal">
        <Checkbox
          checked={filters.noWebsite ?? false}
          onCheckedChange={(checked) => onChange({ noWebsite: checked === true || undefined })}
        />
        Sem site
      </Label>
      {filters.searchId ? (
        <Button variant="secondary" size="sm" onClick={() => onChange({ searchId: undefined })}>
          Só desta busca <XIcon />
        </Button>
      ) : null}
      {hasFilters(filters) ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(NO_FILTERS)}>
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}

/** Applies on blur or Enter, so typing "75" does not filter by 7 first. */
function ScoreInput({
  label,
  placeholder,
  value,
  onCommit,
}: {
  label: string;
  placeholder: string;
  value: number | undefined;
  onCommit: (value: number | undefined) => void;
}) {
  return (
    <Input
      key={value ?? "empty"}
      aria-label={label}
      type="number"
      inputMode="numeric"
      min={0}
      max={100}
      placeholder={placeholder}
      className="w-[6.5rem]"
      defaultValue={value}
      onBlur={(event) => {
        const next = toScore(event.target.value);
        if (next !== value) onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function LoadingRows() {
  return Array.from({ length: 6 }, (_, i) => (
    <TableRow key={i} className="hover:bg-transparent">
      <TableCell colSpan={columns.length}>
        <Skeleton className="h-8 w-full" />
      </TableCell>
    </TableRow>
  ));
}

function hasFilters(filters: LeadFilters) {
  return Object.keys(clean({ ...filters, sort: undefined, dir: undefined })).length > 0;
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

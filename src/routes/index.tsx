import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowDownIcon, ArrowUpIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/app-shell";
import { LeadDetail, LeadPageLink } from "@/components/lead-detail";
import { LeadStatusBadge, ScoreBadge } from "@/components/lead-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { leadCountsQuery, leadsQuery, providerStatusQuery } from "@/lib/queries";
import {
  LEAD_SORT_FIELDS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  leadFiltersSchema,
  SCORE_TIERS,
  type LeadFilters,
  type ScoreTier,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { LeadCounts, LeadRow } from "@/server/leads-query";

// `lead` is UI state (the open side panel), kept out of the data filters.
const searchSchema = leadFiltersSchema.extend({ lead: z.string().max(64).optional() });

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { lead: _lead, ...filters } }) => filters,
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(leadsQuery(deps)),
      context.queryClient.ensureQueryData(leadCountsQuery(deps)),
    ]),
  component: LeadsPage,
});

const features = tableFeatures({ rowSortingFeature });
const helper = createColumnHelper<typeof features, LeadRow>();
const EMPTY: LeadRow[] = [];
const TIERS = ["high", "medium", "low"] as const satisfies readonly ScoreTier[];

const TIER_RANGES: Record<ScoreTier, Pick<LeadFilters, "minScore" | "maxScore">> = {
  high: { minScore: SCORE_TIERS.high.min, maxScore: undefined },
  medium: { minScore: SCORE_TIERS.medium.min, maxScore: SCORE_TIERS.medium.max },
  low: { minScore: undefined, maxScore: SCORE_TIERS.low.max },
};

const RESET: Partial<LeadFilters> = {
  q: undefined,
  status: undefined,
  minScore: undefined,
  maxScore: undefined,
  noWebsite: undefined,
  searchId: undefined,
};

function activeTier(filters: LeadFilters): ScoreTier | undefined {
  return TIERS.find(
    (tier) =>
      TIER_RANGES[tier].minScore === filters.minScore &&
      TIER_RANGES[tier].maxScore === filters.maxScore,
  );
}

function LeadsPage() {
  const { lead: openLeadId, ...filters } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const { data } = useQuery(leadsQuery(filters));
  const { data: counts } = useQuery(leadCountsQuery(filters));

  const setFilters = (patch: Partial<LeadFilters>) =>
    navigate({ search: (prev) => clean({ ...prev, ...patch }), replace: true });
  const openLead = (id: string | undefined, replace = false) =>
    navigate({ search: (prev) => clean({ ...prev, lead: id }), replace });

  const ids = data?.map((lead) => lead.id) ?? [];
  const position = openLeadId ? ids.indexOf(openLeadId) : -1;
  const prevId = position > 0 ? ids[position - 1] : undefined;
  const nextId = position >= 0 ? ids[position + 1] : undefined;

  const exportHref = `/api/leads.csv?${new URLSearchParams(
    Object.entries(clean(filters)).map(([key, value]) => [key, String(value)]),
  ).toString()}`;
  const count = data?.length ?? 0;
  const filtered = hasFilters(filters);
  const firstRun = counts?.total === 0 && !filtered && !filters.status;

  return (
    <>
      <PageHeader
        title="Leads"
        actions={
          count > 0 ? (
            <Button asChild variant="outline">
              <a href={exportHref} download>
                Exportar CSV
              </a>
            </Button>
          ) : null
        }
      />

      {firstRun ? (
        <Onboarding />
      ) : (
        <>
          <StatusTabs
            counts={counts}
            value={filters.status}
            onChange={(status) => void setFilters({ status })}
          />
          <Toolbar filters={filters} counts={counts} onChange={(patch) => void setFilters(patch)} />
          <LeadsTable
            data={data}
            filters={filters}
            filtered={filtered || Boolean(filters.status)}
            onSort={(sort, dir) => void setFilters({ sort, dir })}
            onOpen={(id) => void openLead(id)}
            onReset={() => void setFilters(RESET)}
          />
          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            {data ? `${count} ${count === 1 ? "lead" : "leads"}` : ""}
            {counts?.pending ? ` · ${counts.pending} em análise` : ""}
          </p>
        </>
      )}

      <Sheet open={Boolean(openLeadId)} onOpenChange={(open) => !open && void openLead(undefined)}>
        <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetTitle className="sr-only">Detalhes do lead</SheetTitle>
          <SheetDescription className="sr-only">
            Análise, mensagem e dados de contato do lead.
          </SheetDescription>
          {openLeadId ? (
            <div key={openLeadId} className="flex-1 overflow-y-auto px-5 pt-4 pb-10 sm:px-8">
              {position >= 0 ? (
                <LeadPager
                  position={position}
                  total={ids.length}
                  onPrev={prevId ? () => void openLead(prevId, true) : undefined}
                  onNext={nextId ? () => void openLead(nextId, true) : undefined}
                />
              ) : null}
              <LeadDetail leadId={openLeadId} compact />
              <div className="mt-10 border-t pt-4">
                <LeadPageLink leadId={openLeadId} />
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Previous/next inside the side panel; J and K work as shortcuts. */
function LeadPager({
  position,
  total,
  onPrev,
  onNext,
}: {
  position: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const handlers = useRef({ onPrev, onNext });
  useEffect(() => {
    handlers.current = { onPrev, onNext };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.key === "j") handlers.current.onNext?.();
      if (event.key === "k") handlers.current.onPrev?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const link =
    "underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="mb-6 flex h-8 items-center gap-5 pr-10 text-sm text-muted-foreground">
      <span className="tabular-nums">
        {position + 1} de {total}
      </span>
      <button type="button" className={link} onClick={onPrev} disabled={!onPrev} title="Atalho: K">
        Anterior
      </button>
      <button type="button" className={link} onClick={onNext} disabled={!onNext} title="Atalho: J">
        Próximo
      </button>
    </div>
  );
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

function StatusTabs({
  counts,
  value,
  onChange,
}: {
  counts: LeadCounts | undefined;
  value: LeadFilters["status"];
  onChange: (status: LeadFilters["status"]) => void;
}) {
  const tabs: { value: LeadFilters["status"]; label: string; count?: number }[] = [
    { value: undefined, label: "Todos", count: counts?.total },
    ...LEAD_STATUS_VALUES.map((status) => ({
      value: status,
      label: LEAD_STATUS_LABELS[status],
      count: counts?.byStatus[status],
    })),
  ].filter((tab) => tab.value === undefined || tab.value === value || (tab.count ?? 0) > 0);
  return (
    <div className="no-scrollbar -mx-4 mb-5 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <div role="tablist" aria-label="Status" className="flex gap-6">
        {tabs.map((tab) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.value)}
              className={cn(
                "relative flex items-center gap-2 pb-3 text-sm whitespace-nowrap transition-colors",
                selected
                  ? "font-medium text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="text-xs text-muted-foreground tabular-nums">{tab.count ?? ""}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toolbar({
  filters,
  counts,
  onChange,
}: {
  filters: LeadFilters;
  counts: LeadCounts | undefined;
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

  const tier = activeTier(filters);
  const customRange = !tier && (filters.minScore !== undefined || filters.maxScore !== undefined);
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = (tier ? 1 : 0) + (filters.noWebsite ? 1 : 0);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-0 flex-1 md:w-72 md:flex-none">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Buscar empresa"
          placeholder="Buscar empresa"
          className="h-9 pl-9"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>

      <Button
        variant="outline"
        className="h-9 md:hidden"
        aria-expanded={showFilters}
        onClick={() => setShowFilters((open) => !open)}
      >
        Filtros
        {activeFilters > 0 ? (
          <span className="text-muted-foreground tabular-nums">{activeFilters}</span>
        ) : null}
      </Button>

      <div
        className={cn(
          "w-full flex-wrap items-center gap-2.5 md:flex md:w-auto",
          showFilters ? "flex" : "hidden",
        )}
      >
        <div
          role="radiogroup"
          aria-label="Faixa de nota"
          className="no-scrollbar flex h-9 max-w-full items-center overflow-x-auto rounded-lg border p-0.5 text-sm"
        >
          <Segment
            checked={!tier && !customRange}
            onClick={() => onChange({ minScore: undefined, maxScore: undefined })}
          >
            Toda nota
          </Segment>
          {TIERS.map((key) => (
            <Segment key={key} checked={tier === key} onClick={() => onChange(TIER_RANGES[key])}>
              {SCORE_TIERS[key].label}
              <span className="text-xs text-muted-foreground tabular-nums">
                {counts?.byTier[key] ?? ""}
              </span>
            </Segment>
          ))}
        </div>

        <Chip
          pressed={filters.noWebsite ?? false}
          onClick={() => onChange({ noWebsite: filters.noWebsite ? undefined : true })}
        >
          Sem site
        </Chip>
      </div>

      {filters.searchId ? (
        <Chip pressed onClick={() => onChange({ searchId: undefined })}>
          Só desta busca <XIcon className="size-3.5" />
        </Chip>
      ) : null}
      {customRange ? (
        <Chip pressed onClick={() => onChange({ minScore: undefined, maxScore: undefined })}>
          Nota {filters.minScore ?? 0}–{filters.maxScore ?? 100} <XIcon className="size-3.5" />
        </Chip>
      ) : null}
    </div>
  );
}

function Segment({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "flex h-full items-center gap-1.5 rounded-md px-3 whitespace-nowrap transition-colors",
        checked
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm whitespace-nowrap transition-colors",
        pressed
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const statusColumn = helper.accessor("status", {
  header: "Status",
  enableSorting: false,
  cell: ({ getValue }) => <LeadStatusBadge status={getValue()} />,
});

const columns = helper.columns([
  helper.accessor("name", {
    header: "Empresa",
    sortDescFirst: false,
    cell: ({ row }) => (
      <div className="max-w-80 min-w-48">
        <p className="truncate font-medium" title={row.original.name}>
          {row.original.name}
        </p>
        <RowHint lead={row.original} />
      </div>
    ),
  }),
  helper.accessor("score", {
    header: "Nota",
    cell: ({ row }) => (
      <ScoreBadge score={row.original.score} pending={row.original.analysisStatus === "pending"} />
    ),
  }),
  helper.accessor("phone", {
    header: "Contato",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="grid gap-0.5">
        <span className="whitespace-nowrap tabular-nums">{row.original.phone ?? "—"}</span>
        <span className="max-w-44 truncate text-xs text-muted-foreground">
          {row.original.website ? hostOf(row.original.website) : "sem site"}
        </span>
      </div>
    ),
  }),
  helper.accessor("reviewCount", {
    header: "Google",
    cell: ({ row }) =>
      row.original.rating !== null ? (
        <span className="whitespace-nowrap tabular-nums">
          {row.original.rating.toFixed(1).replace(".", ",")}
          <span className="text-muted-foreground"> ({row.original.reviewCount ?? 0})</span>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  }),
  statusColumn,
]);

const RESPONSIVE: Record<string, string> = {
  reviewCount: "hidden lg:table-cell",
};
const columnsWithoutStatus = columns.filter((column) => column !== statusColumn);

/** Second line under the name: the strongest opportunity, or the analysis state. */
function RowHint({ lead }: { lead: LeadRow }) {
  const text =
    lead.analysisStatus === "pending"
      ? "Aguardando análise"
      : lead.analysisStatus === "error"
        ? "Falha na análise"
        : lead.signals?.[0];
  return text ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{text}</p> : null;
}

function LeadsTable({
  data,
  filters,
  filtered,
  onSort,
  onOpen,
  onReset,
}: {
  data: LeadRow[] | undefined;
  filters: LeadFilters;
  filtered: boolean;
  onSort: (sort: LeadFilters["sort"], dir: LeadFilters["dir"]) => void;
  onOpen: (id: string) => void;
  onReset: () => void;
}) {
  const sorting: SortingState = [
    { id: filters.sort ?? "score", desc: (filters.dir ?? "desc") === "desc" },
  ];
  const table = useTable({
    features,
    columns: filters.status ? columnsWithoutStatus : columns,
    data: data ?? EMPTY,
    manualSorting: true,
    sortDescFirst: true,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      const sort = LEAD_SORT_FIELDS.find((field) => field === first?.id);
      if (sort) onSort(sort, first?.desc ? "desc" : "asc");
    },
  });

  if (data === undefined) {
    return (
      <div className="grid gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    const onlyStatus = Boolean(filters.status) && !hasFilters(filters);
    return (
      <div className="py-16 text-center">
        <p className="font-medium">
          {onlyStatus && filters.status
            ? `Nenhum lead em “${LEAD_STATUS_LABELS[filters.status]}”`
            : filtered
              ? "Nenhum lead com esses filtros"
              : "Nenhum lead"}
        </p>
        {filtered && !onlyStatus ? (
          <Button variant="outline" size="sm" className="mt-4" onClick={onReset}>
            Limpar filtros
          </Button>
        ) : null}
      </div>
    );
  }

  const rows = table.getRowModel().rows;
  return (
    <>
      {/* Phones: card list */}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 md:hidden">
        {rows.map(({ original: lead }) => (
          <li key={lead.id}>
            <button
              type="button"
              onClick={() => onOpen(lead.id)}
              className="flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors active:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{lead.name}</p>
                <RowHint lead={lead} />
              </div>
              <ScoreBadge score={lead.score} pending={lead.analysisStatus === "pending"} />
            </button>
          </li>
        ))}
      </ul>

      {/* Tablets and up: sortable table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
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
                        "h-10 px-4 text-xs font-medium text-muted-foreground",
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
            {rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                aria-label={`Abrir ${row.original.name}`}
                onClick={() => onOpen(row.original.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(row.original.id);
                  }
                }}
                className="cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none"
              >
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className={cn("px-4 py-3", RESPONSIVE[cell.column.id])}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function Onboarding() {
  const { data: status } = useQuery(providerStatusQuery);
  const missingKeys = status && !(status.placesConfigured && status.aiConfigured);
  return (
    <div className="py-20 text-center">
      <p className="font-medium">Nenhum lead ainda</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {missingKeys
          ? "Configure as chaves do Google e da DeepSeek no .dev.vars para começar."
          : "Escolha um nicho e uma cidade para a primeira busca."}
      </p>
      <div className="mt-6 flex justify-center gap-2">
        {status && !status.offerConfigured ? (
          <Button asChild variant="outline">
            <Link to="/settings">Descrever o que você vende</Link>
          </Button>
        ) : null}
        <Button asChild>
          <Link to="/searches/new">Nova busca</Link>
        </Button>
      </div>
    </div>
  );
}

function hasFilters(filters: LeadFilters) {
  const { sort: _sort, dir: _dir, status: _status, ...rest } = clean(filters);
  return Object.keys(rest).length > 0;
}

function clean<T extends Record<string, unknown>>(values: T): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- same keys, only empties removed
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== "" && value !== false,
    ),
  ) as T;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

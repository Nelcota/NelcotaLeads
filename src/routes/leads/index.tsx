import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Page, useOpenNewSearch } from "@/components/app-shell";
import { ScoreBadge, StatusBadge } from "@/components/lead-badges";
import { DispatchSheet } from "@/components/dispatch-sheet";
import { LeadSheet } from "@/components/lead-sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LeadStatus } from "@/db/schema";
import { relativeDay } from "@/lib/format";
import { leadCountsQuery, leadsQuery, searchesQuery } from "@/lib/queries";
import {
  LEAD_VIEW_LABELS,
  LEAD_VIEWS,
  leadFiltersSchema,
  SCORE_TIERS,
  type LeadFilters,
  type LeadView,
  type ScoreTier,
} from "@/lib/schemas";
import { useToday } from "@/lib/today";
import type { LeadRow } from "@/server/leads-query";

// `lead` is UI state (the open side sheet), kept out of the data filters.
const searchSchema = leadFiltersSchema.extend({ lead: z.string().max(64).optional() });

const DEFAULT_VIEW: LeadView = "todo";

export const Route = createFileRoute("/leads/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { lead: _lead, ...filters } }) => withView(filters),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(leadsQuery(deps)),
      context.queryClient.ensureQueryData(leadCountsQuery(deps)),
    ]),
  component: LeadsPage,
});

const TIERS = ["high", "medium", "low"] as const satisfies readonly ScoreTier[];
const TIER_RANGES: Record<ScoreTier, Pick<LeadFilters, "minScore" | "maxScore">> = {
  high: { minScore: SCORE_TIERS.high.min, maxScore: undefined },
  medium: { minScore: SCORE_TIERS.medium.min, maxScore: SCORE_TIERS.medium.max },
  low: { minScore: undefined, maxScore: SCORE_TIERS.low.max },
};
const NO_FILTERS: Partial<LeadFilters> = {
  q: undefined,
  hasEmail: undefined,
  minScore: undefined,
  maxScore: undefined,
  noWebsite: undefined,
  searchId: undefined,
};

// Which statuses still belong to each view after a status change.
const VIEW_STATUSES: Record<LeadView, LeadStatus[] | null> = {
  todo: ["new"],
  followup: ["contacted", "replied"],
  waiting: ["contacted"],
  talking: ["replied"],
  closed: ["closed"],
  discarded: ["discarded"],
  all: null,
};

const SORTS = [
  { value: "auto", label: "Maior nota" },
  { value: "reviewCount", label: "Mais avaliações" },
  { value: "name", label: "Nome" },
  { value: "createdAt", label: "Mais recentes" },
] as const;
type SortValue = (typeof SORTS)[number]["value"];
const SORT_PATCH: Record<SortValue, Pick<LeadFilters, "sort" | "dir">> = {
  auto: { sort: undefined, dir: undefined },
  reviewCount: { sort: "reviewCount", dir: "desc" },
  name: { sort: "name", dir: "asc" },
  createdAt: { sort: "createdAt", dir: "desc" },
};

function withView(filters: LeadFilters): LeadFilters {
  return { ...filters, view: filters.view ?? DEFAULT_VIEW };
}

function activeTier(filters: LeadFilters): ScoreTier | undefined {
  return TIERS.find(
    (tier) =>
      TIER_RANGES[tier].minScore === filters.minScore &&
      TIER_RANGES[tier].maxScore === filters.maxScore,
  );
}

function LeadsPage() {
  const { lead: openLeadId, ...search } = Route.useSearch();
  const filters = withView(search);
  const view = filters.view ?? DEFAULT_VIEW;
  const navigate = useNavigate({ from: "/leads/" });
  const { data } = useQuery(leadsQuery(filters));
  const { data: counts } = useQuery(leadCountsQuery(filters));
  const openNewSearch = useOpenNewSearch();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dispatching, setDispatching] = useState(false);
  const selectedRows = (data ?? []).filter((lead) => selected.has(lead.id));
  const sendable = selectedRows
    .filter((lead) => lead.email && !lead.unsubscribedAt)
    .map((lead) => lead.id);
  const withoutEmail = selectedRows.length - sendable.length;

  const setFilters = (patch: Partial<LeadFilters>) =>
    void navigate({ search: (prev) => clean({ ...prev, ...patch }), replace: true });
  const selectLead = (id: string | undefined) =>
    void navigate({ search: (prev) => clean({ ...prev, lead: id }), replace: true });

  const exportHref = `/api/leads.csv?${new URLSearchParams(
    Object.entries(clean(filters)).map(([key, value]) => [key, String(value)]),
  ).toString()}`;

  const actions = (
    <>
      {data && data.length > 0 ? (
        <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
          <a href={exportHref} download>
            Exportar CSV
          </a>
        </Button>
      ) : null}
      <Button variant="outline" size="sm" onClick={openNewSearch}>
        Busca manual
      </Button>
    </>
  );

  if (counts?.byView.all === 0 && !hasFilters(filters)) {
    return (
      <Page title="Leads" actions={actions}>
        <Card className="mx-auto w-full max-w-lg">
          <CardHeader>
            <CardTitle>Nenhum lead ainda</CardTitle>
            <CardDescription>
              Ligue o piloto automático para receber leads todo dia, ou faça uma busca manual.
            </CardDescription>
          </CardHeader>
          <CardFooter className="gap-2">
            <Button asChild>
              <Link to="/settings" hash="piloto">
                Configurar piloto automático
              </Link>
            </Button>
            <Button variant="outline" onClick={openNewSearch}>
              Busca manual
            </Button>
          </CardFooter>
        </Card>
      </Page>
    );
  }

  return (
    <Page title="Leads" actions={actions}>
      <Tabs
        value={view}
        onValueChange={(value) => {
          const next = LEAD_VIEWS.find((item) => item === value);
          if (next) setFilters({ view: next, sort: undefined, dir: undefined });
        }}
      >
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <TabsList>
            {LEAD_VIEWS.map((item) => (
              <TabsTrigger key={item} value={item} className="gap-1.5">
                {LEAD_VIEW_LABELS[item]}
                <span className="text-muted-foreground tabular-nums">
                  {counts?.byView[item] ?? ""}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <Toolbar filters={filters} view={view} onChange={setFilters} />

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          <span className="font-medium">
            {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
          </span>
          {withoutEmail > 0 ? (
            <span className="opacity-70">
              {withoutEmail} sem e-mail {withoutEmail === 1 ? "fica" : "ficam"} de fora
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={() => setSelected(new Set())}
          >
            Limpar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={sendable.length === 0}
            onClick={() => setDispatching(true)}
          >
            Disparar e-mail
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <LeadsTable
          data={data}
          view={view}
          filtered={hasFilters(filters)}
          selected={selected}
          onToggle={(ids, on) =>
            setSelected((current) => {
              const next = new Set(current);
              for (const id of ids) {
                if (on) next.add(id);
                else next.delete(id);
              }
              return next;
            })
          }
          onOpen={selectLead}
          onReset={() => setFilters(NO_FILTERS)}
        />
      </div>

      <DispatchSheet
        leadIds={sendable}
        open={dispatching}
        onOpenChange={setDispatching}
        onDispatched={() => setSelected(new Set())}
      />
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {data ? `${data.length} ${data.length === 1 ? "lead" : "leads"}` : ""}
        {counts?.pending ? ` · ${counts.pending} em análise` : ""}
      </p>

      <LeadSheet
        leadId={openLeadId}
        ids={data?.map((lead) => lead.id) ?? []}
        onSelect={selectLead}
        keepsLead={(status) => VIEW_STATUSES[view]?.includes(status) ?? true}
      />
    </Page>
  );
}

function Toolbar({
  filters,
  view,
  onChange,
}: {
  filters: LeadFilters;
  view: LeadView;
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

  const { data: searches } = useQuery(searchesQuery);
  const tier = activeTier(filters);
  const activeSearch = searches?.find((item) => item.id === filters.searchId);
  const sortValue: SortValue =
    filters.sort === "reviewCount" || filters.sort === "name" || filters.sort === "createdAt"
      ? filters.sort
      : "auto";
  const datedView = view === "followup" || view === "waiting";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          aria-label="Buscar empresa"
          placeholder="Buscar empresa"
          className="pl-8"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            Nota: {tier ? SCORE_TIERS[tier].label : "todas"}
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuRadioGroup
            value={tier ?? "all"}
            onValueChange={(value) => {
              const next = TIERS.find((item) => item === value);
              onChange(next ? TIER_RANGES[next] : { minScore: undefined, maxScore: undefined });
            }}
          >
            <DropdownMenuRadioItem value="all">Todas</DropdownMenuRadioItem>
            {TIERS.map((item) => (
              <DropdownMenuRadioItem key={item} value={item}>
                {SCORE_TIERS[item].label} ({SCORE_TIERS[item].min}
                {item === "high" ? "+" : `–${SCORE_TIERS[item].max}`})
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="max-w-full">
            <span className="truncate">
              Busca: {activeSearch ? `${activeSearch.niche} em ${activeSearch.city}` : "todas"}
            </span>
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80">
          <DropdownMenuRadioGroup
            value={filters.searchId ?? "all"}
            onValueChange={(value) => onChange({ searchId: value === "all" ? undefined : value })}
          >
            <DropdownMenuRadioItem value="all">Todas</DropdownMenuRadioItem>
            {searches?.map((item) => (
              <DropdownMenuRadioItem key={item.id} value={item.id}>
                {item.niche} em {item.city}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant={filters.noWebsite ? "secondary" : "outline"}
        size="sm"
        aria-pressed={filters.noWebsite ?? false}
        onClick={() => onChange({ noWebsite: filters.noWebsite ? undefined : true })}
      >
        Sem site
      </Button>

      <Button
        variant={filters.hasEmail ? "secondary" : "outline"}
        size="sm"
        aria-pressed={filters.hasEmail ?? false}
        onClick={() => onChange({ hasEmail: filters.hasEmail ? undefined : true })}
      >
        Com e-mail
      </Button>

      <Select
        value={sortValue}
        onValueChange={(next) => {
          const item = SORTS.find((sort) => sort.value === next);
          if (item) onChange(SORT_PATCH[item.value]);
        }}
      >
        <SelectTrigger size="sm" className="ml-auto w-44" aria-label="Ordenar">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {SORTS.map((sort) => (
            <SelectItem key={sort.value} value={sort.value}>
              {sort.value === "auto" && datedView ? "Data de retorno" : sort.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const EMPTY_VIEW_TEXT: Record<LeadView, string> = {
  todo: "Nenhum lead novo para contatar.",
  followup: "Nada para retornar hoje.",
  waiting: "Ninguém aguardando resposta.",
  talking: "Nenhuma conversa em andamento.",
  closed: "Nenhum negócio fechado ainda.",
  discarded: "Nenhum lead descartado.",
  all: "Nenhum lead.",
};

function LeadsTable({
  data,
  view,
  filtered,
  selected,
  onToggle,
  onOpen,
  onReset,
}: {
  data: LeadRow[] | undefined;
  view: LeadView;
  filtered: boolean;
  selected: Set<string>;
  onToggle: (ids: string[], on: boolean) => void;
  onOpen: (id: string) => void;
  onReset: () => void;
}) {
  const today = useToday();
  const showStatus = view === "all";
  const showFollowUp = view === "followup" || view === "waiting" || view === "talking";
  const columns = 6 + (showStatus ? 1 : 0) + (showFollowUp ? 1 : 0);
  const ids = data?.map((lead) => lead.id) ?? [];
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
  const someSelected = !allSelected && ids.some((id) => selected.has(id));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              aria-label="Selecionar todos"
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => onToggle(ids, checked === true)}
            />
          </TableHead>
          <TableHead>Empresa</TableHead>
          <TableHead className="w-20">Nota</TableHead>
          {showStatus ? <TableHead className="hidden sm:table-cell">Status</TableHead> : null}
          {showFollowUp ? <TableHead>Retorno</TableHead> : null}
          <TableHead className="hidden md:table-cell">E-mail</TableHead>
          <TableHead className="hidden sm:table-cell">Telefone</TableHead>
          <TableHead className="hidden lg:table-cell">Google</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data === undefined ? (
          Array.from({ length: 5 }, (_, i) => (
            <TableRow key={i}>
              <TableCell colSpan={columns}>
                <Skeleton className="h-8 w-full" />
              </TableCell>
            </TableRow>
          ))
        ) : data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns} className="h-32 text-center text-muted-foreground">
              {filtered ? "Nenhum lead com esses filtros." : EMPTY_VIEW_TEXT[view]}
              {filtered ? (
                <Button variant="link" onClick={onReset}>
                  Limpar filtros
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ) : (
          data.map((lead) => (
            <TableRow
              key={lead.id}
              tabIndex={0}
              data-state={selected.has(lead.id) ? "selected" : undefined}
              className="cursor-pointer"
              onClick={() => onOpen(lead.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onOpen(lead.id);
              }}
            >
              <TableCell onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  aria-label={`Selecionar ${lead.name}`}
                  checked={selected.has(lead.id)}
                  onCheckedChange={(checked) => onToggle([lead.id], checked === true)}
                />
              </TableCell>
              <TableCell className="max-w-72">
                <p className="truncate font-medium">{lead.name}</p>
                <p className="truncate text-xs text-muted-foreground">{hint(lead)}</p>
              </TableCell>
              <TableCell>
                <ScoreBadge score={lead.score} pending={lead.analysisStatus === "pending"} />
              </TableCell>
              {showStatus ? (
                <TableCell className="hidden sm:table-cell">
                  <StatusBadge status={lead.status} />
                </TableCell>
              ) : null}
              {showFollowUp ? (
                <TableCell className="whitespace-nowrap">
                  {lead.followUpOn ? relativeDay(lead.followUpOn, today) : "sem data"}
                </TableCell>
              ) : null}
              <TableCell className="hidden max-w-56 truncate md:table-cell">
                {lead.unsubscribedAt ? (
                  <span className="text-muted-foreground">descadastrado</span>
                ) : (
                  (lead.email ?? <span className="text-muted-foreground">sem e-mail</span>)
                )}
              </TableCell>
              <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">
                {lead.phone ?? "sem telefone"}
              </TableCell>
              <TableCell className="hidden whitespace-nowrap tabular-nums lg:table-cell">
                {lead.rating !== null
                  ? `${lead.rating.toFixed(1).replace(".", ",")} (${lead.reviewCount ?? 0})`
                  : "sem avaliações"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

/** Second line under the name: whatever helps decide what to do with the lead. */
function hint(lead: LeadRow): string {
  if (lead.analysisStatus === "pending") return "Analisando…";
  if (lead.analysisStatus === "error") return "Falha na análise";
  return lead.signals?.[0] ?? (lead.website ? hostOf(lead.website) : "Sem site");
}

function hasFilters(filters: LeadFilters) {
  const { sort: _sort, dir: _dir, view: _view, ...rest } = clean(filters);
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

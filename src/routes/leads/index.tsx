import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightLeftIcon,
  ArrowUpDownIcon,
  CheckIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  EllipsisIcon,
  FilterXIcon,
  InboxIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  StarIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  Avatar,
  EmptyState,
  FloatingBar,
  Hint,
  InfoTip,
  TONE_TEXT,
  type Tone,
} from "@/components/apple-ui";
import { GLOSSARY } from "@/lib/help";
import { Page, Stat, useOpenNewSearch } from "@/components/app-shell";
import { followUpTone, ScoreBadge, StatusBadge, TIER_TONE } from "@/components/lead-badges";
import { DispatchSheet } from "@/components/dispatch-sheet";
import { LeadSheet } from "@/components/lead-sheet";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  BULK_LIMIT,
  type BulkSnapshot,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VALUES,
  LEAD_VIEW_LABELS,
  LEAD_VIEWS,
  leadFiltersSchema,
  SCORE_TIERS,
  type LeadFilters,
  type LeadView,
  type ScoreTier,
} from "@/lib/schemas";
import { errorToast } from "@/lib/mutation-toasts";
import { useToday } from "@/lib/today";
import { cn } from "@/lib/utils";
import { bulkUpdateLeads, undoBulkUpdateLeads } from "@/server/leads";
import type { LeadRow } from "@/server/leads-query";
import { pageTitle } from "@/lib/page-title";

// `lead` is UI state (the open side sheet), kept out of the data filters.
const searchSchema = leadFiltersSchema.extend({ lead: z.string().max(64).optional() });

const DEFAULT_VIEW: LeadView = "todo";
const NO_SELECTION: ReadonlySet<string> = new Set();

export const Route = createFileRoute("/leads/")({
  head: () => ({ meta: [{ title: pageTitle("Leads") }] }),
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

// Queue counters that ask for attention get the status color.
const VIEW_TONE: Partial<Record<LeadView, Tone>> = {
  followup: "orange",
  talking: "orange",
  closed: "green",
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

// macOS pop-up button look for the filter triggers.
const POPUP =
  "press inline-flex h-9 shrink-0 sm:h-7 items-center gap-1.5 rounded-[8px] bg-fill-2 px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors hover:bg-fill aria-pressed:bg-green/16 aria-pressed:text-green [&_svg]:size-3";

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
  // The selection belongs to one list: another tab, filter, search or sort starts it over.
  const listKey = JSON.stringify(clean(filters));
  const [selection, setSelection] = useState({ key: listKey, ids: NO_SELECTION });
  const selected = selection.key === listKey ? selection.ids : NO_SELECTION;
  const setSelected = (update: (current: ReadonlySet<string>) => ReadonlySet<string>) =>
    setSelection((current) => ({
      key: listKey,
      ids: update(current.key === listKey ? current.ids : NO_SELECTION),
    }));
  const clearSelection = () => setSelected(() => NO_SELECTION);
  const [dispatching, setDispatching] = useState(false);
  const selectedRows = (data ?? []).filter((lead) => selected.has(lead.id));
  const sendable = selectedRows
    .filter((lead) => lead.email && !lead.unsubscribedAt)
    .map((lead) => lead.id);
  const withoutEmail = selectedRows.length - sendable.length;
  const readyIds = (data ?? [])
    .filter((lead) => lead.email && !lead.unsubscribedAt && lead.analysisStatus === "done")
    .map((lead) => lead.id);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

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
        <Button asChild variant="outline" className="hidden sm:inline-flex">
          <a href={exportHref} download>
            <DownloadIcon />
            Exportar CSV
          </a>
        </Button>
      ) : null}
      <Button variant="outline" onClick={openNewSearch} aria-label="Busca manual">
        <PlusIcon />
        <span className="max-sm:hidden">Busca manual</span>
      </Button>
    </>
  );

  if (counts?.byView.all === 0 && !hasFilters(filters)) {
    return (
      <Page title="Leads" actions={actions}>
        <EmptyState
          icon={InboxIcon}
          tone="green"
          className="grouped mx-auto w-full max-w-lg"
          title="Nenhum lead ainda"
          description="Ligue o piloto automático para receber leads todo dia, ou faça uma busca manual."
        >
          <Button asChild>
            <Link to="/settings" hash="piloto">
              Configurar piloto automático
            </Link>
          </Button>
          <Button variant="outline" onClick={openNewSearch}>
            Busca manual
          </Button>
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page
      title="Leads"
      actions={actions}
      description={
        counts ? (
          <>
            <Stat value={counts.byView.all}>leads</Stat>
            {counts.byView.todo > 0 ? (
              <>
                {" · "}
                <Stat value={counts.byView.todo} tone="blue">
                  a contatar
                </Stat>
              </>
            ) : null}
            {counts.pending > 0 ? (
              <>
                {" · "}
                <Stat value={counts.pending} tone="purple">
                  em análise
                </Stat>
              </>
            ) : null}
          </>
        ) : null
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5">
        <Tabs
          value={view}
          onValueChange={(value) => {
            const next = LEAD_VIEWS.find((item) => item === value);
            if (next) setFilters({ view: next, sort: undefined, dir: undefined });
          }}
        >
          <div className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <TabsList>
              {LEAD_VIEWS.map((item) => {
                const count = counts?.byView[item];
                const tone = VIEW_TONE[item];
                return (
                  <TabsTrigger key={item} value={item} className="gap-1.5">
                    {LEAD_VIEW_LABELS[item]}
                    <span
                      className={cn(
                        "text-[11.5px] tabular-nums",
                        tone && count ? TONE_TEXT[tone] : "opacity-60",
                      )}
                    >
                      {count ?? ""}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </Tabs>

        <Toolbar
          filters={filters}
          view={view}
          onChange={setFilters}
          onReset={() => setFilters(NO_FILTERS)}
        />
      </div>

      {view === "todo" && selected.size === 0 && readyIds.length > 0 ? (
        <div className="grouped -mt-2 flex items-center gap-3 px-4 py-2.5">
          <SendIcon className="size-4 shrink-0 text-blue" />
          <p className="min-w-0 flex-1 text-sm">
            <b className="font-medium tabular-nums">{readyIds.length}</b>{" "}
            {readyIds.length === 1 ? "lead pronto" : "leads prontos"} para disparo
            <span className="font-light text-muted-foreground max-sm:hidden">
              {" "}
              (com e-mail e já analisados)
            </span>
          </p>
          <Button size="sm" onClick={() => setSelected(() => new Set(readyIds))}>
            Selecionar {readyIds.length === 1 ? "" : "todos"}
          </Button>
        </div>
      ) : null}

      <div className="grouped -mt-2 overflow-x-auto">
        <LeadsList
          data={data}
          view={view}
          filtered={hasFilters(filters)}
          selected={selected}
          onToggle={toggle}
          onOpen={selectLead}
          onReset={() => setFilters(NO_FILTERS)}
        />
        <LeadsTable
          data={data}
          view={view}
          filtered={hasFilters(filters)}
          selected={selected}
          onToggle={toggle}
          onOpen={selectLead}
          onReset={() => setFilters(NO_FILTERS)}
        />
        <div
          className="flex items-center justify-between gap-4 border-t border-border/70 px-4 py-3 text-xs text-tertiary"
          aria-live="polite"
        >
          <span>
            {data ? (
              <>
                <b className="font-medium text-muted-foreground tabular-nums">{data.length}</b>{" "}
                {data.length === 1 ? "lead" : "leads"}
              </>
            ) : null}
            {counts?.pending ? (
              <span className="text-purple"> · {counts.pending} em análise</span>
            ) : null}
          </span>
          <span className="hidden sm:inline">J e K navegam no lead aberto</span>
        </div>
      </div>

      {selected.size > 0 ? (
        <FloatingBar>
          <span className="font-medium">
            {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
          </span>
          {withoutEmail > 0 ? (
            <span className="text-[12.5px] text-orange">
              {withoutEmail} sem e-mail {withoutEmail === 1 ? "fica" : "ficam"} de fora
            </span>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            className="max-sm:ml-auto"
            aria-label="Limpar seleção"
            onClick={clearSelection}
          >
            <XIcon className="sm:hidden" />
            <span className="max-sm:hidden">Limpar</span>
          </Button>
          <SelectionMenu ids={[...selected]} onDone={clearSelection} />
          <Button size="sm" disabled={sendable.length === 0} onClick={() => setDispatching(true)}>
            <SendIcon />
            Disparar e-mail
          </Button>
        </FloatingBar>
      ) : null}

      <DispatchSheet
        leadIds={sendable}
        open={dispatching}
        onOpenChange={setDispatching}
        onDispatched={clearSelection}
      />

      <LeadSheet
        leadId={openLeadId}
        ids={data?.map((lead) => lead.id) ?? []}
        onSelect={selectLead}
        keepsLead={(status) => VIEW_STATUSES[view]?.includes(status) ?? true}
      />
    </Page>
  );
}

/** Same bound as the CSV route's selection export. */
const EXPORT_SELECTION_LIMIT = 1000;

/**
 * The selection bar's "…": change the status, discard (with undo) or export the selected
 * leads. "Disparar e-mail" stays the one primary action next to it.
 */
function SelectionMenu({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const exportForm = useRef<HTMLFormElement>(null);
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["leads"] }),
      queryClient.invalidateQueries({ queryKey: ["lead"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  const undo = async (status: LeadStatus, previous: BulkSnapshot[]) => {
    try {
      await undoBulkUpdateLeads({ data: { status, previous } });
      await refresh();
    } catch (error) {
      errorToast("Não foi possível desfazer")(error);
    }
  };
  const update = useMutation({
    mutationFn: (status: LeadStatus) =>
      bulkUpdateLeads({ data: { ids: ids.slice(0, BULK_LIMIT), status } }),
    onSuccess: async (result, status) => {
      await refresh();
      onDone();
      const skipped =
        result.skipped > 0
          ? `${result.skipped} não ${result.skipped === 1 ? "mudou" : "mudaram"}: o status atual não permite.`
          : undefined;
      if (result.changed === 0) {
        toast.error("Nenhum lead mudou", { description: skipped });
        return;
      }
      const count = `${result.changed} ${result.changed === 1 ? "lead" : "leads"}`;
      toast(
        status === "discarded"
          ? `${count} ${result.changed === 1 ? "descartado" : "descartados"}`
          : `${count} em ${LEAD_STATUS_LABELS[status]}`,
        {
          description: skipped,
          duration: 8000,
          action: { label: "Desfazer", onClick: () => void undo(status, result.previous) },
        },
      );
    },
    onError: errorToast("Não foi possível mudar os leads"),
  });

  return (
    <>
      <DropdownMenu>
        <Hint label="Mais ações">
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Mais ações para a seleção"
              disabled={update.isPending}
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" side="top" className="w-auto min-w-48">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeftIcon />
              Mudar status
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {LEAD_STATUS_VALUES.filter((status) => status !== "discarded").map((status) => (
                <DropdownMenuItem key={status} onSelect={() => update.mutate(status)}>
                  {LEAD_STATUS_LABELS[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={() => exportForm.current?.requestSubmit()}>
            <DownloadIcon />
            Exportar seleção
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => update.mutate("discarded")}>
            <Trash2Icon />
            Descartar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {/* Posted, not a link: a long selection does not fit in a URL. */}
      <form ref={exportForm} method="post" action="/api/leads.csv" hidden>
        <input type="hidden" name="ids" value={ids.slice(0, EXPORT_SELECTION_LIMIT).join(",")} />
      </form>
    </>
  );
}

function Toolbar({
  filters,
  view,
  onChange,
  onReset,
}: {
  filters: LeadFilters;
  view: LeadView;
  onChange: (patch: Partial<LeadFilters>) => void;
  onReset: () => void;
}) {
  const [q, setQ] = useState(filters.q ?? "");
  const searchRef = useRef<HTMLInputElement>(null);
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

  // Cleared at once, without waiting for the debounce. Always navigates: a search that was
  // just sent may not be in `filters` yet, and would otherwise come back when it lands.
  const clearSearch = () => {
    setQ("");
    onChange({ q: undefined });
  };

  const { data: searches } = useQuery(searchesQuery);
  const tier = activeTier(filters);
  const activeSearch = searches?.find((item) => item.id === filters.searchId);
  const sortValue: SortValue =
    filters.sort === "reviewCount" || filters.sort === "name" || filters.sort === "createdAt"
      ? filters.sort
      : "auto";
  const datedView = view === "followup" || view === "waiting";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:w-60">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-tertiary" />
        <Input
          ref={searchRef}
          type="search"
          aria-label="Buscar empresa"
          placeholder="Buscar empresa"
          className={cn("h-10 rounded-full pl-8 sm:h-8", q && "pr-9")}
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !q) return;
            // Only the search: Esc doesn't also close what is around it.
            event.preventDefault();
            event.stopPropagation();
            clearSearch();
          }}
        />
        {q ? (
          <Hint label="Limpar busca">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Limpar busca"
              className="absolute top-1/2 right-1.5 -translate-y-1/2 sm:right-0.5"
              onClick={() => {
                clearSearch();
                searchRef.current?.focus();
              }}
            >
              <XIcon />
            </Button>
          </Hint>
        ) : null}
      </div>

      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-1 sm:flex-wrap sm:overflow-visible sm:px-0">
        <DropdownMenu>
          <DropdownMenuTrigger className={POPUP}>
            Nota
            <span
              className={cn(
                "font-normal",
                tier ? TONE_TEXT[TIER_TONE[tier]] : "text-muted-foreground",
              )}
            >
              {tier ? SCORE_TIERS[tier].label : "todas"}
            </span>
            <ChevronsUpDownIcon className="text-tertiary" />
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
          <DropdownMenuTrigger className={cn(POPUP, "max-w-full")}>
            Busca
            <span className="truncate font-normal text-muted-foreground">
              {activeSearch ? `${activeSearch.niche} em ${activeSearch.city}` : "todas"}
            </span>
            <ChevronsUpDownIcon className="text-tertiary" />
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

        <button
          type="button"
          className={POPUP}
          aria-pressed={filters.noWebsite ?? false}
          onClick={() => onChange({ noWebsite: filters.noWebsite ? undefined : true })}
        >
          {filters.noWebsite ? <CheckIcon /> : null}
          Sem site
        </button>

        <button
          type="button"
          className={POPUP}
          aria-pressed={filters.hasEmail ?? false}
          onClick={() => onChange({ hasEmail: filters.hasEmail ? undefined : true })}
        >
          {filters.hasEmail ? <CheckIcon /> : null}
          Com e-mail
        </button>

        {hasFilters(filters) ? (
          <button type="button" className={cn(POPUP, "bg-transparent text-blue")} onClick={onReset}>
            <FilterXIcon />
            Limpar filtros
          </button>
        ) : null}

        <Select
          value={sortValue}
          onValueChange={(next) => {
            const item = SORTS.find((sort) => sort.value === next);
            if (item) onChange(SORT_PATCH[item.value]);
          }}
        >
          <SelectTrigger
            size="sm"
            className="ml-auto w-auto shrink-0 max-sm:h-9"
            aria-label="Ordenar"
          >
            <ArrowUpDownIcon className="size-3 text-tertiary" />
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
  selected: ReadonlySet<string>;
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
    <Table className="max-sm:hidden">
      <TableHeader>
        <TableRow className="hover:bg-transparent!">
          <TableHead className="w-12 pl-4">
            <Checkbox
              aria-label="Selecionar todos"
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(checked) => onToggle(ids, checked === true)}
            />
          </TableHead>
          <TableHead>Empresa</TableHead>
          <TableHead className="w-24">
            <span className="inline-flex items-center gap-1.5">
              Nota
              <InfoTip>{GLOSSARY.score.text}</InfoTip>
            </span>
          </TableHead>
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
          <TableRow className="hover:bg-transparent!">
            <TableCell colSpan={columns} className="h-auto">
              <EmptyState
                icon={filtered ? FilterXIcon : InboxIcon}
                title={filtered ? "Nenhum lead com esses filtros." : EMPTY_VIEW_TEXT[view]}
                className="py-10"
              >
                {filtered ? (
                  <Button variant="outline" size="sm" onClick={onReset}>
                    Limpar filtros
                  </Button>
                ) : null}
              </EmptyState>
            </TableCell>
          </TableRow>
        ) : (
          data.map((lead) => {
            const hintText = hint(lead);
            return (
              <TableRow
                key={lead.id}
                tabIndex={0}
                data-state={selected.has(lead.id) ? "selected" : undefined}
                className="group/row cursor-pointer outline-none focus-visible:bg-fill-2"
                onClick={() => onOpen(lead.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") onOpen(lead.id);
                }}
              >
                <TableCell className="pl-4" onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    aria-label={`Selecionar ${lead.name}`}
                    checked={selected.has(lead.id)}
                    onCheckedChange={(checked) => onToggle([lead.id], checked === true)}
                  />
                </TableCell>
                <TableCell className="max-w-80">
                  <div className="flex items-center gap-3">
                    <span className="transition-transform duration-400 ease-spring group-hover/row:scale-110">
                      <Avatar name={lead.name} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{lead.name}</p>
                      <p
                        className={cn(
                          "truncate text-xs",
                          hintText.tone
                            ? cn("font-medium", TONE_TEXT[hintText.tone])
                            : "font-light text-muted-foreground",
                        )}
                      >
                        {hintText.text}
                      </p>
                    </div>
                  </div>
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
                  <TableCell>
                    {lead.followUpOn ? (
                      <Badge variant={followUpTone(lead.followUpOn, today)} dot>
                        {relativeDay(lead.followUpOn, today)}
                      </Badge>
                    ) : (
                      <span className="text-tertiary">sem data</span>
                    )}
                  </TableCell>
                ) : null}
                <TableCell className="hidden max-w-56 truncate md:table-cell">
                  {lead.unsubscribedAt ? (
                    <span className="text-tertiary">descadastrado</span>
                  ) : (
                    (lead.email ?? <span className="text-tertiary">sem e-mail</span>)
                  )}
                </TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">
                  {lead.phone ?? <span className="text-tertiary">sem telefone</span>}
                </TableCell>
                <TableCell className="hidden tabular-nums lg:table-cell">
                  {lead.rating !== null ? (
                    <span className="inline-flex items-center gap-1.5">
                      <StarIcon className="size-3 fill-yellow text-yellow" />
                      {lead.rating.toFixed(1).replace(".", ",")}
                      <span className="text-tertiary">({lead.reviewCount ?? 0})</span>
                    </span>
                  ) : (
                    <span className="text-tertiary">sem avaliações</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

/** The leads as a touch list on phones, where the table has no room. */
function LeadsList({
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
  selected: ReadonlySet<string>;
  onToggle: (ids: string[], on: boolean) => void;
  onOpen: (id: string) => void;
  onReset: () => void;
}) {
  const today = useToday();
  const dated = view === "followup" || view === "waiting" || view === "talking";
  if (data === undefined) {
    return (
      <div className="grid gap-2 p-3 sm:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <EmptyState
        icon={filtered ? FilterXIcon : InboxIcon}
        title={filtered ? "Nenhum lead com esses filtros." : EMPTY_VIEW_TEXT[view]}
        className="py-10 sm:hidden"
      >
        {filtered ? (
          <Button variant="outline" size="sm" onClick={onReset}>
            Limpar filtros
          </Button>
        ) : null}
      </EmptyState>
    );
  }
  return (
    <ul className="sm:hidden">
      {data.map((lead) => {
        const hintText = hint(lead);
        const checked = selected.has(lead.id);
        return (
          <li
            key={lead.id}
            data-state={checked ? "selected" : undefined}
            className="grouped-row flex min-h-[60px] items-center [--inset:52px] data-[state=selected]:bg-green/8"
          >
            <label className="grid h-[60px] w-12 shrink-0 cursor-pointer place-items-center">
              <Checkbox
                aria-label={`Selecionar ${lead.name}`}
                checked={checked}
                onCheckedChange={(value) => onToggle([lead.id], value === true)}
              />
            </label>
            <button
              type="button"
              onClick={() => onOpen(lead.id)}
              className="flex min-w-0 flex-1 items-center gap-3 py-2 pr-4 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{lead.name}</span>
                <span
                  className={cn(
                    "block truncate text-xs",
                    hintText.tone
                      ? cn("font-medium", TONE_TEXT[hintText.tone])
                      : "font-light text-muted-foreground",
                  )}
                >
                  {dated && lead.followUpOn
                    ? `Retorno ${relativeDay(lead.followUpOn, today)}`
                    : hintText.text}
                </span>
              </span>
              <ScoreBadge score={lead.score} pending={lead.analysisStatus === "pending"} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Second line under the name: whatever helps decide what to do with the lead. */
function hint(lead: LeadRow): { text: string; tone?: Tone } {
  if (lead.analysisStatus === "pending") return { text: "Analisando…", tone: "purple" };
  if (lead.analysisStatus === "error") return { text: "Falha na análise", tone: "red" };
  if (lead.analysisStatus === "skipped") return { text: "Não analisado" };
  const signal = lead.signals?.[0];
  if (signal) return { text: signal };
  return lead.website ? { text: hostOf(lead.website) } : { text: "Sem site", tone: "orange" };
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

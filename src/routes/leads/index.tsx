import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  DownloadIcon,
  EllipsisIcon,
  InboxIcon,
  PlusIcon,
  SendIcon,
  UserIcon,
  UserPlusIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { EmptyState, Hint } from "@/components/apple-ui";
import { Page, Stat, useOpenNewSearch } from "@/components/app-shell";
import { AddLeadSheet } from "@/components/add-lead-sheet";
import { DispatchSheet } from "@/components/dispatch-sheet";
import { LeadSheet } from "@/components/lead-sheet";
import { DiscardConfirm, DISCARD_CONFIRM_FROM } from "@/components/leads/discard-confirm";
import { FilterChips, FiltersButton, useFilterChips } from "@/components/leads/leads-filters";
import { LeadsFooter, PAGE_SIZE } from "@/components/leads/leads-footer";
import { LeadsMobileList } from "@/components/leads/leads-mobile-list";
import { LeadsSearch } from "@/components/leads/leads-search";
import {
  EMPTY_VIEW_TEXT,
  LeadsTable,
  type EmptyInfo,
  type SortKey,
  type SortState,
} from "@/components/leads/leads-table";
import { LeadsTabs } from "@/components/leads/leads-tabs";
import { SelectionBar } from "@/components/leads/selection-bar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LeadStatus } from "@/db/schema";
import { useLeadStatusChange } from "@/hooks/use-lead-status-change";
import { useLeadsHotkeys } from "@/hooks/use-leads-hotkeys";
import { useListSelection } from "@/hooks/use-list-selection";
import { clean, hasFilters, NO_FILTERS, popoverFilterCount } from "@/lib/lead-filters";
import { isReadyToDispatch } from "@/lib/lead-row";
import { pageTitle } from "@/lib/page-title";
import { whatsappLink } from "@/lib/phone";
import { leadCountsQuery, leadsQuery } from "@/lib/queries";
import {
  EXPORT_LIMIT,
  leadFiltersSchema,
  lenientSearch,
  type LeadFilters,
  type LeadView,
} from "@/lib/schemas";
import { useNotFoundToast } from "@/lib/not-found-toast";
import { useToday } from "@/lib/today";
import { cn } from "@/lib/utils";

// `lead` (the open side sheet) and `missing` (a link to a lead that is gone) are UI state,
// kept out of the data filters.
const searchSchema = lenientSearch(
  leadFiltersSchema.extend({
    lead: z.string().max(64).optional(),
    missing: z.boolean().optional(),
    // "Disparar prontos" from another tab: select the ready leads once A contatar loads.
    pick: z.literal("ready").optional(),
  }),
);

const DEFAULT_VIEW: LeadView = "todo";

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

/** The order a column starts in when clicked: names A→Z, numbers highest first. */
const SORT_START: Record<SortKey, "asc" | "desc"> = { name: "asc", score: "desc", rating: "desc" };

export const Route = createFileRoute("/leads/")({
  head: () => ({ meta: [{ title: pageTitle("Leads") }] }),
  validateSearch: searchSchema,
  loaderDeps: ({ search: { lead: _lead, missing: _missing, pick: _pick, ...filters } }) =>
    withView(filters),
  loader: ({ context, deps }) =>
    Promise.all([
      context.queryClient.ensureQueryData(leadsQuery(deps)),
      context.queryClient.ensureQueryData(leadCountsQuery(deps)),
    ]),
  component: LeadsPage,
});

function withView(filters: LeadFilters): LeadFilters {
  return { ...filters, view: filters.view ?? DEFAULT_VIEW };
}

function sortState(filters: LeadFilters): SortState {
  const key =
    filters.sort === "name" || filters.sort === "score" || filters.sort === "rating"
      ? filters.sort
      : null;
  if (!key) return null;
  return { key, dir: filters.dir ?? SORT_START[key] };
}

function LeadsPage() {
  const { lead: openLeadId, missing, pick, ...search } = Route.useSearch();
  const filters = withView(search);
  const view = filters.view ?? DEFAULT_VIEW;
  const navigate = useNavigate({ from: "/leads/" });
  useNotFoundToast(
    missing,
    "Lead não encontrado",
    () => void navigate({ search: (prev) => ({ ...prev, missing: undefined }), replace: true }),
  );
  const { data: list } = useQuery(leadsQuery(filters));
  const rows = list?.rows;
  const { data: counts } = useQuery(leadCountsQuery(filters));
  const openNewSearch = useOpenNewSearch();
  const today = useToday();
  const [now] = useState(() => new Date());
  const searchRef = useRef<HTMLInputElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [discarding, setDiscarding] = useState({ open: false, ids: [] as string[] });
  // The tab change remounts the page, so the request rides in the URL (`pick`), not in state.
  const [pickDone, setPickDone] = useState(false);

  // The selection and the page belong to one list: another tab, filter, search or order resets them.
  const listKey = JSON.stringify(clean(filters));
  const selection = useListSelection(listKey);
  const [paging, setPaging] = useState({ key: listKey, page: 0 });
  const page = paging.key === listKey ? paging.page : 0;

  const loaded = rows ?? [];
  const pageRows = loaded.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const readyIds = loaded.filter(isReadyToDispatch).map((lead) => lead.id);
  const selectedRows = loaded.filter((lead) => selection.selected.has(lead.id));
  // Only new leads with an address get a first e-mail (the server skips the rest).
  const sendable = selectedRows
    .filter((lead) => lead.status === "new" && lead.email && !lead.unsubscribedAt)
    .map((lead) => lead.id);
  const pendingInList = loaded.filter((lead) => lead.analysisStatus === "pending").length;

  const statusChange = useLeadStatusChange(selection.clear);
  const chips = useFilterChips(filters);
  const filtered = hasFilters(filters);

  // Adjusted during render: once A contatar has loaded, select its ready leads.
  if (pick === "ready" && !pickDone && view === "todo" && rows !== undefined) {
    setPickDone(true);
    selection.replace(readyIds);
  }
  // Then drop `pick` from the address, so Back or a reload does not select again.
  useEffect(() => {
    if (!pick || !pickDone) return;
    void navigate({ search: (prev) => ({ ...prev, pick: undefined }), replace: true });
  }, [pick, pickDone, navigate]);

  const setFilters = (patch: Partial<LeadFilters>) =>
    void navigate({ search: (prev) => clean({ ...prev, ...patch }), replace: true });
  const selectLead = (id: string | undefined) =>
    void navigate({ search: (prev) => clean({ ...prev, lead: id }), replace: true });

  const sort = sortState(filters);
  const onSort = (key: SortKey) => {
    const dir = sort?.key === key ? (sort.dir === "asc" ? "desc" : "asc") : SORT_START[key];
    setFilters({ sort: key, dir });
  };

  const askDiscard = (ids: string[]) => {
    if (ids.length >= DISCARD_CONFIRM_FROM) {
      setDiscarding({ open: true, ids });
      return;
    }
    statusChange.mutate({ ids, status: "discarded" });
  };

  const openWhatsApp = (id: string) => {
    const lead = loaded.find((item) => item.id === id);
    if (!lead?.phoneE164) {
      toast("Este lead não tem telefone.");
      return;
    }
    window.open(whatsappLink(lead.phoneE164), "_blank", "noopener,noreferrer");
  };

  useLeadsHotkeys(!openLeadId && !dispatching, {
    onSearch: () => searchRef.current?.focus(),
    onToggle: (id) => selection.toggle([id], !selection.selected.has(id)),
    onWriteEmail: selectLead,
    onWhatsApp: openWhatsApp,
  });

  const primary =
    selection.selected.size > 0
      ? {
          label: `Disparar ${sendable.length} ${sendable.length === 1 ? "selecionado" : "selecionados"}`,
          disabled: sendable.length === 0,
          onClick: () => setDispatching(true),
        }
      : {
          label:
            view === "todo"
              ? `Disparar ${readyIds.length} ${readyIds.length === 1 ? "pronto" : "prontos"}`
              : "Disparar prontos",
          disabled: view === "todo" && readyIds.length === 0,
          onClick: () => {
            if (view === "todo") {
              selection.replace(readyIds);
              toast(
                `${readyIds.length} ${readyIds.length === 1 ? "lead pronto marcado" : "leads prontos marcados"}. Confira e clique em Disparar.`,
              );
              return;
            }
            void navigate({
              search: (prev) =>
                clean({ ...prev, view: "todo", sort: undefined, dir: undefined, pick: "ready" }),
              replace: true,
            });
          },
        };

  const exportHref = `/api/leads.csv?${new URLSearchParams(
    Object.entries(clean(filters)).map(([key, value]) => [key, String(value)]),
  ).toString()}`;

  const actions = (
    <>
      {loaded.length > 0 ? (
        <Button asChild variant="outline" className="hidden border border-border sm:inline-flex">
          <a
            href={exportHref}
            download
            onClick={() => {
              const total = counts?.byView[view] ?? 0;
              if (total > EXPORT_LIMIT)
                toast.warning(
                  `O arquivo traz os primeiros ${EXPORT_LIMIT.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} leads. Use filtros para exportar o resto.`,
                );
            }}
          >
            <DownloadIcon />
            Exportar CSV
          </a>
        </Button>
      ) : null}
      <Button
        variant="outline"
        className="border border-border"
        onClick={openNewSearch}
        aria-label="Nova busca"
      >
        <PlusIcon />
        <span className="max-sm:hidden">Nova busca</span>
      </Button>
      <DropdownMenu>
        <Hint label="Mais ações">
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="border border-border"
              aria-label="Mais ações"
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" className="w-auto min-w-44">
          <DropdownMenuItem onSelect={() => setAdding(true)}>
            <UserPlusIcon />
            Adicionar lead
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button disabled={primary.disabled} onClick={primary.onClick} aria-label={primary.label}>
        <SendIcon />
        <span className="max-sm:hidden">{primary.label}</span>
      </Button>
    </>
  );
  const addLead = (
    <AddLeadSheet open={adding} onOpenChange={setAdding} onOpenLead={(id) => selectLead(id)} />
  );

  if (counts?.byView.all === 0 && !filtered && !filters.mine) {
    return (
      <Page title="Leads" actions={actions}>
        <EmptyState
          icon={InboxIcon}
          tone="blue"
          className="mx-auto w-full max-w-lg rounded-[20px] border border-border bg-card"
          title="Nenhum lead ainda"
          description="Ligue a busca diária para receber leads todo dia, ou faça uma nova busca."
        >
          <Button asChild>
            <Link to="/settings" hash="piloto">
              Configurar busca diária
            </Link>
          </Button>
          <Button variant="outline" onClick={openNewSearch}>
            Nova busca
          </Button>
        </EmptyState>
        {addLead}
        <LeadSheet leadId={openLeadId} ids={[]} onSelect={selectLead} keepsLead={() => true} />
      </Page>
    );
  }

  const empty: EmptyInfo = filtered
    ? {
        title: "Nenhum lead com esses filtros.",
        action: { label: "Limpar filtros", onClick: () => setFilters(NO_FILTERS) },
      }
    : filters.mine
      ? {
          title:
            'Nenhum lead seu nesta aba. Use "Assumir" no painel do lead para ele aparecer aqui.',
          action: { label: "Ver todos os leads", onClick: () => setFilters({ mine: undefined }) },
        }
      : { title: EMPTY_VIEW_TEXT[view] };

  const handlers = {
    onToggle: selection.toggle,
    onOpen: selectLead,
    onWriteEmail: selectLead,
    onMove: (id: string, status: "contacted" | "replied") =>
      statusChange.mutate({ ids: [id], status }),
    onDiscard: (id: string) => askDiscard([id]),
  };

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
                <Stat value={counts.byView.todo}>a contatar</Stat>
              </>
            ) : null}
            {counts.pending > 0 ? (
              <>
                {" · "}
                <Stat value={counts.pending}>em análise</Stat>
              </>
            ) : null}
          </>
        ) : null
      }
    >
      <LeadsTabs
        view={view}
        counts={counts}
        onSelect={(next) => setFilters({ view: next, sort: undefined, dir: undefined })}
      />

      <section
        className="enter -mt-2 rounded-[20px] border border-border bg-card"
        aria-label="Lista de leads"
      >
        <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-4 py-3">
          <LeadsSearch
            ref={searchRef}
            value={filters.q ?? ""}
            onCommit={(next) => setFilters({ q: next || undefined })}
            shortcutsOpen={shortcutsOpen}
            onShortcutsOpenChange={setShortcutsOpen}
          />
          <Button
            variant="outline"
            aria-pressed={filters.mine ?? false}
            onClick={() => setFilters({ mine: filters.mine ? undefined : true })}
            className={cn(
              "h-9 border border-border",
              filters.mine &&
                "border-transparent bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent [&_svg]:text-current",
            )}
          >
            <UserIcon />
            Meus leads
          </Button>
          <div className="ml-auto">
            <FiltersButton
              filters={filters}
              count={popoverFilterCount(filters)}
              shown={rows === undefined ? undefined : loaded.length}
              onChange={setFilters}
              onReset={() => setFilters(NO_FILTERS)}
            />
          </div>
          <FilterChips chips={chips} onChange={setFilters} onReset={() => setFilters(NO_FILTERS)} />
        </div>

        <div className="overflow-hidden rounded-b-[20px]">
          <LeadsMobileList
            rows={pageRows}
            loading={rows === undefined}
            empty={empty}
            selected={selection.selected}
            onToggle={selection.toggle}
            onOpen={selectLead}
          />
          <LeadsTable
            rows={pageRows}
            loading={rows === undefined}
            view={view}
            empty={empty}
            selected={selection.selected}
            sort={sort}
            onSort={onSort}
            handlers={handlers}
            busy={statusChange.isPending}
            today={today}
            now={now}
          />
          {rows !== undefined && loaded.length > 0 ? (
            <LeadsFooter
              total={loaded.length}
              pending={pendingInList}
              truncatedOf={list?.truncated ? (counts?.byView[view] ?? null) : null}
              page={page}
              onPage={(next) => setPaging({ key: listKey, page: next })}
            />
          ) : null}
        </div>
      </section>

      {selection.selected.size > 0 ? (
        <SelectionBar
          ids={[...selection.selected]}
          sendable={sendable.length}
          busy={statusChange.isPending}
          onDispatch={() => setDispatching(true)}
          onMove={(status) => statusChange.mutate({ ids: [...selection.selected], status })}
          onDiscard={() => askDiscard([...selection.selected])}
          onClear={selection.clear}
        />
      ) : null}

      <DiscardConfirm
        open={discarding.open}
        count={discarding.ids.length}
        onCancel={() => setDiscarding((current) => ({ ...current, open: false }))}
        onConfirm={() => {
          statusChange.mutate({ ids: discarding.ids, status: "discarded" });
          setDiscarding((current) => ({ ...current, open: false }));
        }}
      />

      <DispatchSheet
        leadIds={sendable}
        open={dispatching}
        onOpenChange={setDispatching}
        onDispatched={selection.clear}
      />

      {addLead}

      <LeadSheet
        leadId={openLeadId}
        ids={loaded.map((lead) => lead.id)}
        onSelect={selectLead}
        keepsLead={(status) => VIEW_STATUSES[view]?.includes(status) ?? true}
      />
    </Page>
  );
}

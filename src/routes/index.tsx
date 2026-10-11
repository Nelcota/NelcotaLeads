import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { z } from "zod";
import { useOpenNewSearch } from "@/components/app-shell";
import { LeadDetail } from "@/components/lead-detail";
import { ScoreBadge } from "@/components/lead-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeadStatus, Search } from "@/db/schema";
import { relativeDay } from "@/lib/format";
import { leadCountsQuery, leadsQuery, providerStatusQuery, searchesQuery } from "@/lib/queries";
import {
  LEAD_STATUS_LABELS,
  LEAD_VIEW_LABELS,
  LEAD_VIEWS,
  leadFiltersSchema,
  SCORE_TIERS,
  type LeadFilters,
  type LeadView,
  type ScoreTier,
} from "@/lib/schemas";
import { useToday } from "@/lib/today";
import { cn } from "@/lib/utils";
import type { LeadCounts, LeadRow } from "@/server/leads-query";

// `lead` is UI state (the open lead), kept out of the data filters.
const searchSchema = leadFiltersSchema.extend({ lead: z.string().max(64).optional() });

const DEFAULT_VIEW: LeadView = "todo";

export const Route = createFileRoute("/")({
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
  minScore: undefined,
  maxScore: undefined,
  noWebsite: undefined,
  searchId: undefined,
};

// Which queues a lead still belongs to after its status changes.
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

const isWide = () => window.matchMedia("(min-width: 768px)").matches;

function LeadsPage() {
  const { lead: openLeadId, ...search } = Route.useSearch();
  const filters = withView(search);
  const view = filters.view ?? DEFAULT_VIEW;
  const navigate = useNavigate({ from: "/" });
  const { data } = useQuery(leadsQuery(filters));
  const { data: counts } = useQuery(leadCountsQuery(filters));
  const searchInput = useRef<HTMLInputElement>(null);
  const openNewSearch = useOpenNewSearch();

  const setFilters = (patch: Partial<LeadFilters>) =>
    void navigate({
      search: (prev) => clean({ ...prev, ...patch, lead: undefined }),
      replace: true,
    });
  const selectLead = (id: string | undefined, replace = isWide()) =>
    void navigate({ search: (prev) => clean({ ...prev, lead: id }), replace });

  const ids = data?.map((lead) => lead.id) ?? [];
  const position = openLeadId ? ids.indexOf(openLeadId) : -1;
  const prevId = position > 0 ? ids[position - 1] : undefined;
  const nextId = position >= 0 ? ids[position + 1] : undefined;

  // Neighbors of the open lead, kept from the last render where it was still listed,
  // so the inbox can move on after the lead leaves the queue.
  const neighbors = useRef({ prevId, nextId });
  useEffect(() => {
    if (position >= 0) neighbors.current = { prevId, nextId };
  }, [position, prevId, nextId]);

  const onStatusChanged = (status: LeadStatus) => {
    const keeps = VIEW_STATUSES[view];
    if (keeps && !keeps.includes(status)) {
      selectLead(neighbors.current.nextId ?? neighbors.current.prevId, true);
    }
  };

  // On wide screens the first lead opens by itself, like an inbox.
  const firstId = data?.[0]?.id;
  useEffect(() => {
    if (!openLeadId && firstId && isWide()) {
      void navigate({ search: (prev) => clean({ ...prev, lead: firstId }), replace: true });
    }
  }, [openLeadId, firstId, navigate]);

  useShortcuts({
    onNext: nextId ? () => selectLead(nextId, true) : undefined,
    onPrev: prevId ? () => selectLead(prevId, true) : undefined,
    onSearch: () => searchInput.current?.focus(),
  });

  const noLeadsYet = counts?.byView.all === 0 && !hasFilters(filters);
  if (noLeadsYet) return <Onboarding onNewSearch={openNewSearch} />;

  const exportHref = `/api/leads.csv?${new URLSearchParams(
    Object.entries(clean(filters)).map(([key, value]) => [key, String(value)]),
  ).toString()}`;

  return (
    <div className="flex h-full md:grid md:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[232px_360px_minmax(0,1fr)]">
      <Rail filters={filters} view={view} counts={counts} onChange={setFilters} />

      <section
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col md:border-r",
          openLeadId && "max-md:hidden",
        )}
        aria-label="Lista de leads"
      >
        <ListHeader
          filters={filters}
          view={view}
          counts={counts}
          searchInput={searchInput}
          onChange={setFilters}
        />
        <OfferNotice />
        <LeadList
          data={data}
          view={view}
          selectedId={openLeadId}
          filtered={hasFilters(filters)}
          onSelect={(id) => selectLead(id)}
          onReset={() => setFilters(NO_FILTERS)}
        />
        <div className="flex items-center justify-between gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
          <span aria-live="polite">
            {data ? `${data.length} ${data.length === 1 ? "lead" : "leads"}` : ""}
            {counts?.pending ? ` · ${counts.pending} em análise` : ""}
          </span>
          {data && data.length > 0 ? (
            <a href={exportHref} download className="hover:text-foreground hover:underline">
              Exportar CSV
            </a>
          ) : null}
        </div>
      </section>

      <section
        className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", !openLeadId && "max-md:hidden")}
        aria-label="Lead"
      >
        {openLeadId ? (
          <LeadDetail
            key={openLeadId}
            leadId={openLeadId}
            onStatusChanged={onStatusChanged}
            toolbar={
              <Pager
                position={position}
                total={ids.length}
                onBack={() => selectLead(undefined, false)}
                onPrev={prevId ? () => selectLead(prevId, true) : undefined}
                onNext={nextId ? () => selectLead(nextId, true) : undefined}
              />
            }
          />
        ) : (
          <div className="grid h-full place-items-center p-8 text-center text-sm text-muted-foreground">
            {data && data.length > 0 ? "Escolha um lead na lista." : null}
          </div>
        )}
      </section>
    </div>
  );
}

function useShortcuts(handlers: {
  onNext?: () => void;
  onPrev?: () => void;
  onSearch: () => void;
}) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (event.key === "j") ref.current.onNext?.();
      else if (event.key === "k") ref.current.onPrev?.();
      else if (event.key === "/") {
        event.preventDefault();
        ref.current.onSearch();
      } else return;
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
      target.closest("[role=listbox],[role=dialog]") !== null)
  );
}

function Rail({
  filters,
  view,
  counts,
  onChange,
}: {
  filters: LeadFilters;
  view: LeadView;
  counts: LeadCounts | undefined;
  onChange: (patch: Partial<LeadFilters>) => void;
}) {
  const { data: searches } = useQuery(searchesQuery);
  const tier = activeTier(filters);
  return (
    <aside className="hidden min-h-0 flex-col gap-6 overflow-x-hidden overflow-y-auto border-r bg-sidebar px-3 py-4 xl:flex">
      <RailGroup>
        {LEAD_VIEWS.map((item) => (
          <RailItem
            key={item}
            active={view === item}
            count={counts?.byView[item]}
            highlight={item === "followup"}
            onClick={() => onChange({ view: item, sort: undefined, dir: undefined })}
            className={item === "closed" ? "mt-3" : undefined}
          >
            {LEAD_VIEW_LABELS[item]}
          </RailItem>
        ))}
      </RailGroup>

      <RailGroup title="Nota">
        {TIERS.map((key) => (
          <RailItem
            key={key}
            active={tier === key}
            count={counts?.byTier[key]}
            onClick={() =>
              onChange(
                tier === key ? { minScore: undefined, maxScore: undefined } : TIER_RANGES[key],
              )
            }
          >
            {SCORE_TIERS[key].label}{" "}
            <span className="text-muted-foreground">
              {key === "high"
                ? `${SCORE_TIERS.high.min}+`
                : `${SCORE_TIERS[key].min}–${SCORE_TIERS[key].max}`}
            </span>
          </RailItem>
        ))}
        <RailItem
          active={filters.noWebsite ?? false}
          onClick={() => onChange({ noWebsite: filters.noWebsite ? undefined : true })}
        >
          Sem site
        </RailItem>
      </RailGroup>

      {searches && searches.length > 0 ? (
        <RailGroup title="Buscas">
          {searches.slice(0, 8).map((search) => (
            <RailItem
              key={search.id}
              active={filters.searchId === search.id}
              count={search.foundCount}
              onClick={() =>
                onChange({ searchId: filters.searchId === search.id ? undefined : search.id })
              }
            >
              {searchLabel(search)}
            </RailItem>
          ))}
          <Link
            to="/searches"
            className="px-3 pt-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            Ver todas
          </Link>
        </RailGroup>
      ) : null}
    </aside>
  );
}

function RailGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      {title ? <h2 className="mb-1 px-3 text-xs text-muted-foreground">{title}</h2> : null}
      {children}
    </div>
  );
}

function RailItem({
  active,
  count,
  highlight,
  onClick,
  className,
  children,
}: {
  active: boolean;
  count?: number;
  highlight?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors",
        active
          ? "bg-background font-medium text-foreground shadow-xs ring-1 ring-border"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      {count !== undefined && count > 0 ? (
        <span
          className={cn(
            "shrink-0 text-xs tabular-nums",
            highlight ? "font-medium text-brand" : "text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function ListHeader({
  filters,
  view,
  counts,
  searchInput,
  onChange,
}: {
  filters: LeadFilters;
  view: LeadView;
  counts: LeadCounts | undefined;
  searchInput: RefObject<HTMLInputElement | null>;
  onChange: (patch: Partial<LeadFilters>) => void;
}) {
  const [q, setQ] = useState(filters.q ?? "");
  const [showFilters, setShowFilters] = useState(false);
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
  const activeSearch = searches?.find((search) => search.id === filters.searchId);
  const sortValue: SortValue =
    filters.sort === "reviewCount" || filters.sort === "name" || filters.sort === "createdAt"
      ? filters.sort
      : "auto";
  const datedQueue = view === "followup" || view === "waiting";
  const extraFilters = (tier ? 1 : 0) + (filters.noWebsite ? 1 : 0);

  return (
    <div className="grid gap-2 border-b p-3">
      <div className="flex gap-2 xl:hidden">
        <Select
          value={view}
          onValueChange={(next) => {
            const item = LEAD_VIEWS.find((value) => value === next);
            if (item) onChange({ view: item, sort: undefined, dir: undefined });
          }}
        >
          <SelectTrigger className="h-9 min-w-0 flex-1" aria-label="Fila">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_VIEWS.map((item) => (
              <SelectItem key={item} value={item}>
                {LEAD_VIEW_LABELS[item]}
                <span className="text-muted-foreground tabular-nums">
                  {counts?.byView[item] ?? ""}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="h-9"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((open) => !open)}
        >
          Filtros
          {extraFilters > 0 ? (
            <span className="text-muted-foreground tabular-nums">{extraFilters}</span>
          ) : null}
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInput}
            type="search"
            aria-label="Buscar empresa"
            placeholder="Buscar empresa"
            className="h-9 pl-9"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <Select
          value={sortValue}
          onValueChange={(next) => {
            const item = SORTS.find((sort) => sort.value === next);
            if (item) onChange(SORT_PATCH[item.value]);
          }}
        >
          <SelectTrigger className="h-9 w-auto" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {SORTS.map((sort) => (
              <SelectItem key={sort.value} value={sort.value}>
                {sort.value === "auto" && datedQueue ? "Data de retorno" : sort.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showFilters ? (
        <div className="flex flex-wrap gap-2 xl:hidden">
          {TIERS.map((key) => (
            <Chip
              key={key}
              pressed={tier === key}
              onClick={() =>
                onChange(
                  tier === key ? { minScore: undefined, maxScore: undefined } : TIER_RANGES[key],
                )
              }
            >
              Nota {SCORE_TIERS[key].label.toLowerCase()}
              <span className="opacity-60 tabular-nums">{counts?.byTier[key] ?? ""}</span>
            </Chip>
          ))}
          <Chip
            pressed={filters.noWebsite ?? false}
            onClick={() => onChange({ noWebsite: filters.noWebsite ? undefined : true })}
          >
            Sem site
          </Chip>
        </div>
      ) : null}

      {activeSearch ? (
        <div className="flex">
          <Chip pressed onClick={() => onChange({ searchId: undefined })}>
            {searchLabel(activeSearch)} <XIcon className="size-3.5" />
          </Chip>
        </div>
      ) : null}
    </div>
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
        "inline-flex h-8 max-w-full items-center gap-1.5 truncate rounded-md border px-2.5 text-sm whitespace-nowrap transition-colors",
        pressed
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function OfferNotice() {
  const { data: status } = useQuery(providerStatusQuery);
  if (!status || status.offerConfigured) return null;
  return (
    <p className="border-b bg-muted/40 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
      Sem a sua oferta, a nota e a mensagem saem genéricas.{" "}
      <Link to="/settings" className="text-foreground underline underline-offset-4">
        Descrever o que eu vendo
      </Link>
    </p>
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

function LeadList({
  data,
  view,
  selectedId,
  filtered,
  onSelect,
  onReset,
}: {
  data: LeadRow[] | undefined;
  view: LeadView;
  selectedId: string | undefined;
  filtered: boolean;
  onSelect: (id: string) => void;
  onReset: () => void;
}) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const today = useToday();
  useEffect(() => {
    if (selectedId) selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  if (data === undefined) {
    return (
      <div className="grid gap-px p-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }
  if (data.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {filtered ? "Nenhum lead com esses filtros." : EMPTY_VIEW_TEXT[view]}
        </p>
        {filtered ? (
          <Button variant="outline" size="sm" onClick={onReset}>
            Limpar filtros
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {data.map((lead) => {
        const selected = lead.id === selectedId;
        const hint = leadHint(lead, view, today);
        return (
          <li key={lead.id}>
            <button
              ref={selected ? selectedRef : undefined}
              type="button"
              aria-current={selected || undefined}
              onClick={() => onSelect(lead.id)}
              className={cn(
                "block w-full border-b px-4 py-3 text-left transition-colors",
                selected
                  ? "bg-muted shadow-[inset_2px_0_0_var(--foreground)]"
                  : "hover:bg-muted/50",
              )}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium">{lead.name}</span>
                <ScoreBadge
                  score={lead.score}
                  pending={lead.analysisStatus === "pending"}
                  className="shrink-0"
                />
              </span>
              <span className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                <span className={cn("truncate", hint.due && "font-medium text-brand")}>
                  {hint.text}
                </span>
                {lead.rating !== null ? (
                  <span className="shrink-0 tabular-nums">
                    {lead.rating.toFixed(1).replace(".", ",")} ({lead.reviewCount ?? 0})
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Second line of a list item: whatever helps decide what to do with the lead. */
function leadHint(lead: LeadRow, view: LeadView, today: string): { text: string; due?: boolean } {
  if (lead.analysisStatus === "pending") return { text: "Analisando…" };
  if (lead.analysisStatus === "error") return { text: "Falha na análise" };
  const prefix =
    view === "all" && lead.status !== "new" ? `${LEAD_STATUS_LABELS[lead.status]} · ` : "";
  if ((lead.status === "contacted" || lead.status === "replied") && lead.followUpOn) {
    return {
      text: `${prefix}Retornar ${relativeDay(lead.followUpOn, today)}`,
      due: lead.followUpOn <= today,
    };
  }
  const detail = lead.signals?.[0] ?? (lead.website ? hostOf(lead.website) : "Sem site");
  return { text: `${prefix}${detail}` };
}

function Pager({
  position,
  total,
  onBack,
  onPrev,
  onNext,
}: {
  position: number;
  total: number;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const link =
    "underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="flex h-8 items-center gap-5 text-sm text-muted-foreground">
      <button type="button" className={cn(link, "md:hidden")} onClick={onBack}>
        Voltar
      </button>
      {position >= 0 ? (
        <>
          <span className="ml-auto tabular-nums md:ml-0">
            {position + 1} de {total}
          </span>
          <button type="button" className={link} onClick={onPrev} disabled={!onPrev}>
            Anterior
          </button>
          <button type="button" className={link} onClick={onNext} disabled={!onNext}>
            Próximo
          </button>
          <span className="ml-auto hidden text-xs lg:inline">J e K para navegar</span>
        </>
      ) : null}
    </div>
  );
}

function Onboarding({ onNewSearch }: { onNewSearch: () => void }) {
  const { data: status } = useQuery(providerStatusQuery);
  const missingKeys = status && !(status.placesConfigured && status.aiConfigured);
  return (
    <div className="mx-auto grid max-w-md gap-3 px-6 py-24 text-center">
      <h1 className="text-xl font-medium">Nenhum lead ainda</h1>
      <p className="text-sm text-muted-foreground">
        {missingKeys
          ? "Configure as chaves do Google e da DeepSeek no .dev.vars para começar."
          : "Busque um nicho numa cidade. As empresas aparecem aqui já avaliadas, da maior nota para a menor."}
      </p>
      <div className="mt-3 flex justify-center gap-2">
        {status && !status.offerConfigured ? (
          <Button asChild variant="outline">
            <Link to="/settings">Descrever o que eu vendo</Link>
          </Button>
        ) : null}
        <Button onClick={onNewSearch}>Nova busca</Button>
      </div>
    </div>
  );
}

function searchLabel(search: Pick<Search, "niche" | "city">) {
  return `${search.niche} · ${search.city}`;
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

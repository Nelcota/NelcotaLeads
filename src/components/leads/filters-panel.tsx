import {
  ChevronLeftIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TagIcon,
  XIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SearchableList } from "@/components/searchable-list";
import { ContactGroup, OwnerGroup, PickRow, TierGroup } from "@/components/leads/filter-groups";
import type { FilterList, useFiltersPanel } from "@/hooks/use-filters-panel";
import type { LeadFilters } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type Chip = { key: string; label: string; clear: Partial<LeadFilters> };

type Panel = ReturnType<typeof useFiltersPanel>;

type FiltersPanelProps = {
  panel: Panel;
  filters: LeadFilters;
  chips: readonly Chip[];
  /** Leads in the current tab with these filters. */
  shown: number | undefined;
  onChange: (patch: Partial<LeadFilters>) => void;
  onReset: () => void;
  onClose: () => void;
};

const SLIDE =
  "transition-[opacity,transform] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transform-none motion-reduce:duration-150";

// The list turns visible at once (so its field can take focus) and hidden only after sliding out.
const LIST_SHOWN = "visible [transition-property:opacity,transform]";
const LIST_HIDDEN =
  "invisible translate-x-4 opacity-0 [transition-property:opacity,transform,visibility]";

const LISTS = {
  niche: {
    title: "Nicho",
    placeholder: "Buscar nicho",
    allLabel: "Todos os nichos",
    noun: { one: "nicho", many: "nichos", none: "nicho" },
  },
  search: {
    title: "Busca",
    placeholder: "Nicho ou cidade",
    allLabel: "Todas as buscas",
    noun: { one: "busca", many: "buscas", none: "busca" },
  },
} as const;

/**
 * The "Filtros" panel: applied chips, the groups, and Nicho or Busca opening as a list over the
 * groups, so the panel keeps its size. Filters apply as they change.
 */
export function FiltersPanel(props: FiltersPanelProps) {
  const { panel, filters, chips, shown, onChange } = props;
  const open = panel.list !== null;
  const kind = panel.shownList;
  const pickedNiche = panel.nicheOptions.find((item) => item.key === filters.niche);
  const pickedSearch = panel.searchOptions.find((item) => item.key === filters.searchId);
  const selected = kind === "niche" ? filters.niche : filters.searchId;

  const pick = (key: string | undefined) => {
    onChange(kind === "niche" ? { niche: key } : { searchId: key });
    panel.closeList();
  };

  return (
    <div className="flex max-h-[min(640px,calc(var(--radix-popover-content-available-height)-34px))] flex-col gap-4">
      <p className="flex items-center gap-1.5 text-base font-semibold">
        <SlidersHorizontalIcon aria-hidden className="size-4" />
        Filtros
      </p>
      <AppliedChips chips={chips} onChange={onChange} />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          inert={open}
          className={cn(
            "-mx-2 grid min-h-0 flex-1 gap-4 overflow-x-hidden overflow-y-auto overscroll-contain px-2 [scrollbar-width:thin] [&>*+*]:border-t [&>*+*]:border-border [&>*+*]:pt-4",
            SLIDE,
            open && "pointer-events-none -translate-x-3 opacity-0",
          )}
        >
          <PickRow
            id="filter-niche"
            icon={TagIcon}
            label="Nicho"
            value={pickedNiche?.label ?? filters.niche ?? "Todos os nichos"}
            expanded={panel.list === "niche"}
            onOpen={() => panel.openList("niche")}
          />
          <PickRow
            id="filter-search"
            icon={SearchIcon}
            label="Busca"
            value={pickedSearch?.label ?? (filters.searchId ? "Busca oculta" : "Todas as buscas")}
            expanded={panel.list === "search"}
            onOpen={() => panel.openList("search")}
          />
          <TierGroup filters={filters} onChange={onChange} />
          <OwnerGroup filters={filters} owners={panel.owners} onChange={onChange} />
          <ContactGroup filters={filters} onChange={onChange} />
        </div>

        <div
          inert={!open}
          className={cn(
            "absolute inset-0 flex flex-col bg-popover",
            SLIDE,
            open ? LIST_SHOWN : LIST_HIDDEN,
          )}
        >
          <ListHead kind={kind} onBack={panel.closeList} />
          <SearchableList
            key={kind}
            label={LISTS[kind].title}
            placeholder={LISTS[kind].placeholder}
            allLabel={LISTS[kind].allLabel}
            noun={LISTS[kind].noun}
            options={kind === "niche" ? panel.nicheOptions : panel.searchOptions}
            selected={selected}
            onPick={pick}
            onExit={panel.closeList}
            active={open}
            className="flex-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Button type="button" variant="ghost" disabled={chips.length === 0} onClick={props.onReset}>
          Limpar tudo
        </Button>
        <Button type="button" className="flex-1" aria-live="polite" onClick={props.onClose}>
          {shown === undefined
            ? "Mostrar leads"
            : `Mostrar ${shown} ${shown === 1 ? "lead" : "leads"}`}
        </Button>
      </div>
    </div>
  );
}

function ListHead({ kind, onBack }: { kind: FilterList; onBack: () => void }) {
  return (
    <div className="mb-1 flex min-h-8 items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="-ml-1.5 inline-flex h-8 items-center gap-0.5 rounded-full pr-2.5 pl-1 text-sm font-medium text-blue transition-colors hover:bg-fill-2 active:bg-fill"
      >
        <ChevronLeftIcon aria-hidden className="size-4" />
        Filtros
      </button>
      <span className="font-semibold">{LISTS[kind].title}</span>
    </div>
  );
}

function AppliedChips({
  chips,
  onChange,
}: {
  chips: readonly Chip[];
  onChange: (patch: Partial<LeadFilters>) => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="-mt-1 flex flex-wrap gap-1.5" aria-label="Filtros aplicados">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-label={`Remover filtro ${chip.label}`}
          onClick={() => onChange(chip.clear)}
          className="inline-flex h-8 max-w-full items-center gap-1.5 truncate rounded-full border border-border bg-fill-2 pr-2 pl-3 text-sm font-medium transition-colors hover:bg-fill"
        >
          <span className="truncate">{chip.label}</span>
          <XIcon aria-hidden className="size-3.5 flex-none text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}

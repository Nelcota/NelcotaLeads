import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontalIcon, XIcon } from "@/components/icons";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FiltersPanel, type Chip } from "@/components/leads/filters-panel";
import { useFiltersPanel } from "@/hooks/use-filters-panel";
import { nichesQuery, searchesQuery, teamMembersQuery } from "@/lib/queries";
import { activeTier } from "@/lib/lead-filters";
import { STAGE_LABELS } from "@/lib/lead-row";
import { NO_OWNER, SCORE_TIERS, type LeadFilters } from "@/lib/schemas";
import { searchLabel } from "@/lib/searches";

const TOGGLE_CHIPS = [
  { key: "noWebsite", label: "Sem site" },
  { key: "hasEmail", label: "Com e-mail" },
  { key: "hasPhone", label: "Com telefone" },
  { key: "fresh", label: "Chegaram hoje" },
] as const;

/** The filters inside the "Filtros" button, as removable chips. */
export function useFilterChips(filters: LeadFilters): Chip[] {
  const { data: searches } = useQuery(searchesQuery);
  const { data: niches } = useQuery(nichesQuery);
  const { data: members } = useQuery({ ...teamMembersQuery, enabled: Boolean(filters.owner) });
  const tier = activeTier(filters);
  const chips: Chip[] = [];
  if (filters.niche) {
    const niche = niches?.find((item) => item.key === filters.niche);
    chips.push({ key: "niche", label: niche?.label ?? filters.niche, clear: { niche: undefined } });
  }
  if (filters.searchId) {
    const search = searches?.find((item) => item.id === filters.searchId);
    chips.push({
      key: "search",
      label: search ? searchLabel(search) : "Busca oculta",
      clear: { searchId: undefined },
    });
  }
  if (tier)
    chips.push({
      key: "tier",
      label: `Nota ${SCORE_TIERS[tier].label.toLowerCase()}`,
      clear: { minScore: undefined, maxScore: undefined },
    });
  if (filters.mine) chips.push({ key: "mine", label: "Meus leads", clear: { mine: undefined } });
  if (filters.owner) chips.push(ownerChip(filters.owner, members));
  for (const toggle of TOGGLE_CHIPS) {
    if (filters[toggle.key])
      chips.push({ key: toggle.key, label: toggle.label, clear: { [toggle.key]: undefined } });
  }
  if (filters.stage)
    chips.push({
      key: "stage",
      label: `Etapa: ${STAGE_LABELS[filters.stage]}`,
      clear: { stage: undefined },
    });
  return chips;
}

/** "Phellipe" or "Sem responsável", also set by the Equipe page's links. */
function ownerChip(
  owner: string,
  members: readonly { id: string; name: string }[] | undefined,
): Chip {
  if (owner === NO_OWNER)
    return { key: "owner", label: "Sem responsável", clear: { owner: undefined } };
  const name = members?.find((member) => member.id === owner)?.name ?? "pessoa removida";
  return { key: "owner", label: `Responsável: ${name}`, clear: { owner: undefined } };
}

export function FilterChips({
  chips,
  onChange,
  onReset,
}: {
  chips: Chip[];
  onChange: (patch: Partial<LeadFilters>) => void;
  onReset: () => void;
}) {
  if (chips.length === 0) return null;
  return (
    <div className="flex basis-full flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-fill-2 pr-1 pl-3 text-sm font-medium"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`Remover filtro ${chip.label}`}
            onClick={() => onChange(chip.clear)}
            className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-fill hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </span>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={onReset}>
        Limpar filtros
      </Button>
    </div>
  );
}

/** "Filtros": the button and its panel. While it is open, the page hides its own chips. */
export function FiltersButton({
  filters,
  chips,
  count,
  shown,
  open,
  onOpenChange,
  onChange,
  onReset,
}: {
  filters: LeadFilters;
  chips: Chip[];
  /** Active filters inside the panel. */
  count: number;
  /** Leads in the current tab with these filters, for "Mostrar N leads". */
  shown: number | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<LeadFilters>) => void;
  onReset: () => void;
}) {
  const panel = useFiltersPanel();
  const content = useRef<HTMLDivElement>(null);

  const changeOpen = (next: boolean) => {
    if (!next) panel.closeList();
    onOpenChange(next);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" aria-expanded={open}>
          <SlidersHorizontalIcon />
          Filtros
          {count > 0 ? <span className="font-semibold tabular-nums">· {count}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={16}
        // Esc inside Nicho or Busca belongs to the list: it clears the field, then goes back.
        onEscapeKeyDown={(event) => {
          if (panel.list) event.preventDefault();
        }}
        // Focus lands on the panel itself, so no option looks picked; Tab then walks its controls.
        ref={content}
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          content.current?.focus({ preventScroll: true });
        }}
        className="w-[min(340px,calc(100vw-32px))] rounded-[16px] border border-border bg-popover p-4 shadow-none outline-none backdrop-blur-none"
      >
        <FiltersPanel
          panel={panel}
          filters={filters}
          chips={chips}
          shown={shown}
          onChange={onChange}
          onReset={onReset}
          onClose={() => changeOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

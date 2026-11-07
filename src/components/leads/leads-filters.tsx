import { useQuery } from "@tanstack/react-query";
import {
  ClockIcon,
  GaugeIcon,
  GlobeIcon,
  MailIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  TagIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LIST_CHECKBOX } from "@/components/leads/lead-cells";
import { nichesQuery, searchesQuery } from "@/lib/queries";
import { activeTier, TIER_RANGES, TIERS } from "@/lib/lead-filters";
import { SCORE_TIERS, type LeadFilters } from "@/lib/schemas";
import { searchLabel } from "@/lib/searches";
import { cn } from "@/lib/utils";

type Chip = { key: string; label: string; clear: Partial<LeadFilters> };

/** The filters inside the "Filtros" button, as removable chips under the bar. */
export function useFilterChips(filters: LeadFilters): Chip[] {
  const { data: searches } = useQuery(searchesQuery);
  const { data: niches } = useQuery(nichesQuery);
  const tier = activeTier(filters);
  const chips: Chip[] = [];
  if (tier)
    chips.push({
      key: "tier",
      label: `Nota: ${SCORE_TIERS[tier].label.toLowerCase()}`,
      clear: { minScore: undefined, maxScore: undefined },
    });
  if (filters.niche) {
    const niche = niches?.find((item) => item.key === filters.niche);
    chips.push({
      key: "niche",
      label: `Nicho: ${niche?.label ?? filters.niche}`,
      clear: { niche: undefined },
    });
  }
  if (filters.searchId) {
    const search = searches?.find((item) => item.id === filters.searchId);
    chips.push({
      key: "search",
      label: `Busca: ${search ? searchLabel(search) : "oculta"}`,
      clear: { searchId: undefined },
    });
  }
  if (filters.noWebsite)
    chips.push({ key: "site", label: "Sem site", clear: { noWebsite: undefined } });
  if (filters.hasEmail)
    chips.push({ key: "email", label: "Com e-mail", clear: { hasEmail: undefined } });
  if (filters.fresh)
    chips.push({ key: "fresh", label: "Chegaram hoje", clear: { fresh: undefined } });
  return chips;
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
      <button
        type="button"
        onClick={onReset}
        className="h-8 px-2 text-sm font-medium text-blue hover:underline"
      >
        Limpar filtros
      </button>
    </div>
  );
}

function Group({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.04em] text-tertiary uppercase">
        {icon}
        {label}
      </span>
      {children}
    </div>
  );
}

function Toggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="flex h-9 cursor-pointer items-center gap-2.5 text-sm font-medium">
      <Checkbox
        className={LIST_CHECKBOX}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </label>
  );
}

/**
 * "Filtros": Nota, Nicho, Busca and the three switches in one compact popover. Filters apply as
 * they change; "Concluído" only closes it.
 */
export function FiltersButton({
  filters,
  count,
  shown,
  onChange,
  onReset,
}: {
  filters: LeadFilters;
  /** Active filters inside the popover. */
  count: number;
  /** Leads in the current tab with these filters, for the footer. */
  shown: number | undefined;
  onChange: (patch: Partial<LeadFilters>) => void;
  onReset: () => void;
}) {
  const { data: searches } = useQuery(searchesQuery);
  const { data: niches } = useQuery(nichesQuery);
  const tier = activeTier(filters);
  const icon = "size-3.5";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9 border border-border">
          <SlidersHorizontalIcon />
          Filtros
          {count > 0 ? <span className="font-semibold tabular-nums">· {count}</span> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="grid w-[340px] gap-4 rounded-[16px] border border-border bg-popover p-4 shadow-none backdrop-blur-none"
      >
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold">Filtros</p>
          <button
            type="button"
            onClick={onReset}
            className="text-sm font-medium text-blue hover:underline"
          >
            Limpar
          </button>
        </div>

        <Group icon={<GaugeIcon className={icon} />} label="Nota">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Nota">
            {([undefined, ...TIERS] as const).map((item) => {
              const active = item === tier;
              return (
                <button
                  key={item ?? "all"}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange(
                      item ? TIER_RANGES[item] : { minScore: undefined, maxScore: undefined },
                    )
                  }
                  className={cn(
                    "h-8 rounded-full border px-3 text-sm font-medium transition-colors",
                    active
                      ? "border-transparent bg-primary font-semibold text-primary-foreground"
                      : "border-border bg-fill-2 hover:bg-fill",
                  )}
                >
                  {item ? SCORE_TIERS[item].label : "Todas"}
                </button>
              );
            })}
          </div>
        </Group>

        <Group icon={<TagIcon className={icon} />} label="Nicho">
          <Select
            value={filters.niche ?? "all"}
            onValueChange={(value) => onChange({ niche: value === "all" ? undefined : value })}
          >
            <SelectTrigger className="h-9 w-full" aria-label="Nicho">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os nichos</SelectItem>
              {niches?.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Group>

        <Group icon={<SearchIcon className={icon} />} label="Busca">
          <Select
            value={filters.searchId ?? "all"}
            onValueChange={(value) => onChange({ searchId: value === "all" ? undefined : value })}
          >
            <SelectTrigger className="h-9 w-full" aria-label="Busca">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as buscas</SelectItem>
              {searches?.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {searchLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Group>

        <div className="grid">
          <Toggle
            icon={<GlobeIcon className={icon} />}
            label="Sem site"
            checked={filters.noWebsite ?? false}
            onChange={(on) => onChange({ noWebsite: on || undefined })}
          />
          <Toggle
            icon={<MailIcon className={icon} />}
            label="Com e-mail"
            checked={filters.hasEmail ?? false}
            onChange={(on) => onChange({ hasEmail: on || undefined })}
          />
          <Toggle
            icon={<ClockIcon className={icon} />}
            label="Chegaram hoje"
            checked={filters.fresh ?? false}
            onChange={(on) => onChange({ fresh: on || undefined })}
          />
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="text-[13px] text-tertiary" aria-live="polite">
            {shown === undefined ? "" : `${shown} ${shown === 1 ? "lead" : "leads"} nesta aba`}
          </span>
          <PopoverClose />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PopoverClose() {
  return (
    <PopoverPrimitive.Close asChild>
      <Button size="sm">Concluído</Button>
    </PopoverPrimitive.Close>
  );
}

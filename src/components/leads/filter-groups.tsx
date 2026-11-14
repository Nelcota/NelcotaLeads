import {
  ChevronRightIcon,
  ClockIcon,
  GaugeIcon,
  GlobeIcon,
  InboxIcon,
  MailIcon,
  PhoneIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ChoicePill } from "@/components/ui/choice-pill";
import { LIST_CHECKBOX } from "@/components/leads/lead-cells";
import { useRadioArrows } from "@/hooks/use-radio-arrows";
import { ownerKey, type OwnerChoice } from "@/hooks/use-filters-panel";
import { activeTier, TIER_RANGES, TIERS } from "@/lib/lead-filters";
import { SCORE_TIERS, type LeadFilters, type ScoreTier } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type Change = (patch: Partial<LeadFilters>) => void;

/** A group's name with its icon, in sentence case (no uppercase labels). */
export function FilterGroupLabel({
  id,
  icon: Icon,
  children,
}: {
  id: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      id={id}
      className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
    >
      <Icon aria-hidden className="size-4" />
      {children}
    </span>
  );
}

/** "Nicho  Todos os nichos ›": opens its list inside the panel. */
export function PickRow({
  id,
  icon,
  label,
  value,
  expanded,
  onOpen,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  expanded: boolean;
  onOpen: () => void;
}) {
  return (
    <div>
      <FilterGroupLabel id={`${id}-label`} icon={icon}>
        {label}
      </FilterGroupLabel>
      <button
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={expanded}
        onClick={onOpen}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-border px-3 text-left text-base transition-colors hover:border-muted-foreground hover:bg-fill-2 active:bg-fill"
      >
        <span id={`${id}-value`} className="min-w-0 flex-1 truncate">
          {value}
        </span>
        <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}

const TIER_CHOICES = [undefined, ...TIERS] as const;

export function TierGroup({ filters, onChange }: { filters: LeadFilters; onChange: Change }) {
  const tier = activeTier(filters);
  const pick = (item: ScoreTier | undefined) =>
    onChange(item ? TIER_RANGES[item] : { minScore: undefined, maxScore: undefined });
  const arrows = useRadioArrows(TIER_CHOICES, pick);
  return (
    <div>
      <FilterGroupLabel id="filter-tier" icon={GaugeIcon}>
        Nota
      </FilterGroupLabel>
      <div role="radiogroup" aria-labelledby="filter-tier" className="flex flex-wrap gap-1.5">
        {TIER_CHOICES.map((item, index) => (
          <ChoicePill
            key={item ?? "all"}
            ref={arrows.register(index)}
            size="sm"
            role="radio"
            aria-checked={item === tier}
            tabIndex={item === tier ? 0 : -1}
            selected={item === tier}
            onClick={() => pick(item)}
            onKeyDown={(event) => arrows.onKeyDown(event, index)}
          >
            {item ? SCORE_TIERS[item].label : "Todas"}
          </ChoicePill>
        ))}
      </div>
    </div>
  );
}

export function OwnerGroup({
  filters,
  owners,
  onChange,
}: {
  filters: LeadFilters;
  owners: readonly OwnerChoice[];
  onChange: Change;
}) {
  const current = ownerKey(filters);
  const arrows = useRadioArrows(owners, (owner) => onChange(owner.patch));
  return (
    <div>
      <FilterGroupLabel id="filter-owner" icon={UsersIcon}>
        Responsável
      </FilterGroupLabel>
      <div role="radiogroup" aria-labelledby="filter-owner" className="grid grid-cols-2 gap-1.5">
        {owners.map((owner, index) => (
          <ChoicePill
            key={owner.key}
            ref={arrows.register(index)}
            size="sm"
            role="radio"
            aria-checked={owner.key === current}
            tabIndex={owner.key === current ? 0 : -1}
            selected={owner.key === current}
            onClick={() => onChange(owner.patch)}
            onKeyDown={(event) => arrows.onKeyDown(event, index)}
            className="w-full min-w-0 justify-start"
          >
            <span className="truncate">{owner.label}</span>
          </ChoicePill>
        ))}
      </div>
    </div>
  );
}

type ToggleKey = "noWebsite" | "hasEmail" | "hasPhone" | "fresh";

const TOGGLES: readonly { key: ToggleKey; label: string; icon: LucideIcon }[] = [
  { key: "noWebsite", label: "Sem site", icon: GlobeIcon },
  { key: "hasEmail", label: "Com e-mail", icon: MailIcon },
  { key: "hasPhone", label: "Com telefone", icon: PhoneIcon },
  { key: "fresh", label: "Chegaram hoje", icon: ClockIcon },
];

export function ContactGroup({ filters, onChange }: { filters: LeadFilters; onChange: Change }) {
  return (
    <div>
      <FilterGroupLabel id="filter-contact" icon={InboxIcon}>
        Contato e chegada
      </FilterGroupLabel>
      <div role="group" aria-labelledby="filter-contact" className="grid">
        {TOGGLES.map(({ key, label, icon: Icon }) => (
          <label
            key={key}
            className={cn(
              "-mx-1.5 flex h-10 cursor-pointer pointer-coarse:h-11 items-center gap-2.5 rounded-lg px-1.5 text-base transition-colors hover:bg-fill-2 active:bg-fill",
            )}
          >
            <Checkbox
              className={LIST_CHECKBOX}
              checked={filters[key] ?? false}
              onCheckedChange={(value) => onChange({ [key]: value === true ? true : undefined })}
            />
            <Icon aria-hidden className="size-4 text-muted-foreground" />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

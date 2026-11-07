import { SCORE_TIERS, type LeadFilters, type ScoreTier } from "@/lib/schemas";

export const TIERS = ["high", "medium", "low"] as const satisfies readonly ScoreTier[];

export const TIER_RANGES: Record<ScoreTier, Pick<LeadFilters, "minScore" | "maxScore">> = {
  high: { minScore: SCORE_TIERS.high.min, maxScore: undefined },
  medium: { minScore: SCORE_TIERS.medium.min, maxScore: SCORE_TIERS.medium.max },
  low: { minScore: undefined, maxScore: SCORE_TIERS.low.max },
};

/** The score band the min/max range matches, if any. */
export function activeTier(filters: LeadFilters): ScoreTier | undefined {
  return TIERS.find(
    (tier) =>
      TIER_RANGES[tier].minScore === filters.minScore &&
      TIER_RANGES[tier].maxScore === filters.maxScore,
  );
}

/** Everything "Limpar filtros" resets (the tab, the order and "Meus leads" stay). */
export const NO_FILTERS: Partial<LeadFilters> = {
  q: undefined,
  hasEmail: undefined,
  minScore: undefined,
  maxScore: undefined,
  noWebsite: undefined,
  searchId: undefined,
  niche: undefined,
  fresh: undefined,
};

/** Drops empty values, so the URL only carries what is set. */
export function clean<T extends Record<string, unknown>>(values: T): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- same keys, only empties removed
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== "" && value !== false,
    ),
  ) as T;
}

/** Whether a search or a filter narrows the list (the tab, order and "Meus leads" don't count). */
export function hasFilters(filters: LeadFilters): boolean {
  const { sort: _sort, dir: _dir, view: _view, mine: _mine, ...rest } = clean(filters);
  return Object.keys(rest).length > 0;
}

/** How many filters sit inside the "Filtros" button (the search box is not one of them). */
export function popoverFilterCount(filters: LeadFilters): number {
  return [
    activeTier(filters) !== undefined,
    Boolean(filters.niche),
    Boolean(filters.searchId),
    Boolean(filters.noWebsite),
    Boolean(filters.hasEmail),
    Boolean(filters.fresh),
  ].filter(Boolean).length;
}

import { ratePercent } from "./overview-metrics";

/**
 * A niche's outcome in a period. `won` and `lost` happened in the period (any lead); the cohort
 * counts are of the leads first contacted in it, the base the shares are taken from.
 */
type NicheOutcome = {
  key: string;
  contacted: number;
  won: number;
  lost: number;
  cohortWon: number;
  cohortLost: number;
};

/** Fewest losses for a niche to be tagged "mais recusa". */
export const MIN_LOST_FOR_TAG = 2;

type Counter = (row: NicheOutcome) => number;
type Rank = { key: string; share: number; count: number };

/**
 * The niches tagged in the table: "mais fecha" (best share of its contacted leads that closed,
 * at least one deal) and "mais recusa" (highest share lost, at least MIN_LOST_FOR_TAG losses).
 * The shares are within the period's contacted cohort, so they never pass 100%; when no niche
 * has a cohort that qualifies, the raw counts of the period decide. Ties go to the larger
 * count, then to the first row.
 */
export function nicheTags(rows: readonly NicheOutcome[]): {
  mostCloses: string | null;
  mostRefuses: string | null;
} {
  return {
    mostCloses: leader(
      rows,
      (row) => row.cohortWon,
      (row) => row.won,
      1,
    ),
    mostRefuses: leader(
      rows,
      (row) => row.cohortLost,
      (row) => row.lost,
      MIN_LOST_FOR_TAG,
    ),
  };
}

function cohortRank(row: NicheOutcome, cohort: Counter, minimum: number): Rank | null {
  const count = cohort(row);
  if (row.contacted <= 0 || count < minimum) return null;
  return { key: row.key, share: count / row.contacted, count };
}

function rawRank(row: NicheOutcome, raw: Counter, minimum: number): Rank | null {
  const count = raw(row);
  if (count < minimum) return null;
  return { key: row.key, share: 0, count };
}

function beatsRank(rank: Rank, best: Rank | null): boolean {
  if (!best) return true;
  return rank.share > best.share || (rank.share === best.share && rank.count > best.count);
}

function leader(
  rows: readonly NicheOutcome[],
  cohort: Counter,
  raw: Counter,
  minimum: number,
): string | null {
  const byCohort = rows.flatMap((row) => cohortRank(row, cohort, minimum) ?? []);
  const ranks =
    byCohort.length > 0 ? byCohort : rows.flatMap((row) => rawRank(row, raw, minimum) ?? []);
  let best: Rank | null = null;
  for (const rank of ranks) {
    if (beatsRank(rank, best)) best = rank;
  }
  return best?.key ?? null;
}

export type NicheTag = "mostCloses" | "mostRefuses";

/** The tags of one niche: "mais fecha", "mais recusa", both or none. */
export function tagsOf(key: string, tags: ReturnType<typeof nicheTags>): NicheTag[] {
  const closes: NicheTag[] = tags.mostCloses === key ? ["mostCloses"] : [];
  const refuses: NicheTag[] = tags.mostRefuses === key ? ["mostRefuses"] : [];
  return [...closes, ...refuses];
}

/** The caption after the period: who closes the most, or what the card compares. */
export function nicheCaption(
  niches: readonly { key: string; label: string }[],
  best: string | null,
): string {
  const topNiche = niches.find((niche) => niche.key === best);
  if (!topNiche) return "quem responde, fecha e recusa mais, por área.";
  return `${topNiche.label} é quem mais fecha.`;
}

export type NicheStepTone = "primary" | "blue" | "green" | "red";

export type NicheStep = {
  label: string;
  value: number;
  /** Share of the niche's contacted leads; null when there is no base for it. */
  percent: number | null;
  /** The contacted row: the base the others are a share of, shown without a percent. */
  isBase: boolean;
  /** Bar length, 0 to 100. */
  width: number;
  tone: NicheStepTone;
};

type NicheFunnel = NicheOutcome & { replied: number };

/** Shortest bar, so a count above zero always shows. */
const MIN_BAR = 3;

/** Bar length for a share: visible when there is at least one, never past 100%. */
function barWidth(count: number, percent: number | null): number {
  if (percent === null || count <= 0) return 0;
  return Math.min(Math.max(percent, MIN_BAR), 100);
}

/**
 * A share of the contacted leads. Deals closed or lost in the period by leads contacted before
 * it have no base here: the count shows, with a short bar and no percent, instead of "1 · 0%".
 */
function shareStep(
  label: string,
  value: number,
  cohort: number,
  contacted: number,
  tone: NicheStepTone,
): NicheStep {
  if (value > 0 && cohort <= 0) {
    return { label, value, percent: null, isBase: false, width: MIN_BAR, tone };
  }
  const percent = ratePercent(cohort, contacted);
  return { label, value, percent, isBase: false, width: barWidth(cohort, percent), tone };
}

/** Whether a niche did anything in the period besides having leads found. */
export function hasNicheActivity(niche: Pick<NicheOutcome, "contacted" | "won" | "lost">): boolean {
  return niche.contacted + niche.won + niche.lost > 0;
}

/**
 * The funnel of one niche card: contacted (the base, full bar), then replied, won and lost as a
 * share of the contacted leads. Won and lost count the period; their shares come from the
 * contacted cohort, as in the niche tags, so they never pass 100%.
 */
export function nicheSteps(niche: NicheFunnel): NicheStep[] {
  const base: NicheStep = {
    label: "Contatados",
    value: niche.contacted,
    percent: null,
    isBase: true,
    width: niche.contacted > 0 ? 100 : 0,
    tone: "primary",
  };
  return [
    base,
    shareStep("Responderam", niche.replied, niche.replied, niche.contacted, "blue"),
    shareStep("Fecharam", niche.won, niche.cohortWon, niche.contacted, "green"),
    shareStep("Recusaram", niche.lost, niche.cohortLost, niche.contacted, "red"),
  ];
}

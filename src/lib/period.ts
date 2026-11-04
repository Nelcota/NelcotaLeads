import { z } from "zod";
import { addDays, brazilInstant, localDay } from "./format";

/** The windows the Visão geral metrics can show; remembered in the URL as `?period=`. */
export const OVERVIEW_PERIODS = ["7d", "30d", "month"] as const;
export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];

export const DEFAULT_PERIOD: OverviewPeriod = "30d";

export const overviewPeriodSchema = z.enum(OVERVIEW_PERIODS);

/** The selector's options. */
export const PERIOD_OPTION_LABELS: Record<OverviewPeriod, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  month: "Este mês",
};

/** How the cards name the period: "últimos 30 dias". */
export const PERIOD_CAPTIONS: Record<OverviewPeriod, string> = {
  "7d": "últimos 7 dias",
  "30d": "últimos 30 dias",
  month: "este mês",
};

/**
 * A span of Brazil days, `fromDay` to `toDay` inclusive, and the instants that bound it:
 * `from` (inclusive, midnight of the first day) and `to` (exclusive, midnight after the last).
 */
export type DayRange = { fromDay: string; toDay: string; from: Date; to: Date };

/** The range from `fromDay` through `toDay`, both Brazil days. */
export function dayRange(fromDay: string, toDay: string): DayRange {
  return {
    fromDay,
    toDay,
    from: brazilInstant(fromDay, "00:00"),
    to: brazilInstant(addDays(toDay, 1), "00:00"),
  };
}

const PERIOD_DAYS: Record<Exclude<OverviewPeriod, "month">, number> = { "7d": 7, "30d": 30 };

/** First day of the period, counting today as one of its days (Brazil time). */
function periodStart(period: OverviewPeriod, today: string): string {
  if (period === "month") return `${today.slice(0, 7)}-01`;
  return addDays(today, 1 - PERIOD_DAYS[period]);
}

/** The days a period covers, up to and including today (Brazil time). */
export function periodRange(period: OverviewPeriod, now: Date): DayRange {
  const today = localDay(now);
  return dayRange(periodStart(period, today), today);
}

/** `?period=` read leniently: anything unknown falls back to the default. */
export function readPeriod(value: OverviewPeriod | undefined): OverviewPeriod {
  return value ?? DEFAULT_PERIOD;
}

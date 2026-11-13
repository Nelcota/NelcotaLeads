import { addDays, dayDiff, formatCount, pluralize } from "./format";

/** Scores are counted in bands of 5 (0–4, 5–9 … 100), the minimum score's step. */
export const SCORE_BAND_SIZE = 5;

/** The AI answers a conversation at most this many times before handing it to the team. */
export const AI_REPLY_LIMIT = 3;

/** One band of analyzed leads: `band` × 5 is its lowest score. */
export type ScoreBand = { band: number; leads: number };

/** Analyzed leads scoring below `minScore`, and all analyzed leads. */
export function leadsBelow(bands: readonly ScoreBand[], minScore: number) {
  const total = bands.reduce((sum, row) => sum + row.leads, 0);
  const below = bands
    .filter((row) => row.band * SCORE_BAND_SIZE < minScore)
    .reduce((sum, row) => sum + row.leads, 0);
  return { below, total };
}

/** "Com 30, ficariam abaixo da nota 18 de 142 leads analisados." under the minimum score. */
export function minScoreImpact(bands: readonly ScoreBand[], minScore: number): string {
  const { below, total } = leadsBelow(bands, minScore);
  if (total === 0) return "Ainda não há leads analisados para comparar.";
  const of = pluralize(total, "lead analisado", "leads analisados");
  if (below === 0) return `Com ${minScore}, nenhum de ${of} ficaria abaixo da nota.`;
  const verb = below === 1 ? "ficaria" : "ficariam";
  return `Com ${minScore}, ${verb} abaixo da nota ${formatCount(below)} de ${of}.`;
}

/**
 * When the daily search runs next: today at its hour while that hour has not come and today has
 * not run, otherwise tomorrow. Null when it is off or has nothing to search.
 */
export function nextDailySearch(
  search: { enabled: boolean; hour: number; targets: number; lastRunOn: string | null },
  today: string,
  nowHour: number,
): string | null {
  if (!search.enabled || search.targets === 0) return null;
  const ranToday = search.lastRunOn === today;
  const day = !ranToday && nowHour < search.hour ? today : addDays(today, 1);
  return `${dayDiff(today, day) === 0 ? "Hoje" : "Amanhã"}, ${search.hour}h`;
}

/** "Hoje" or "Ontem" or "dd/mm" for the last daily search day. */
export function lastDailySearch(lastRunOn: string | null, today: string): string | null {
  if (!lastRunOn) return null;
  const diff = dayDiff(lastRunOn, today);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  return `${lastRunOn.slice(8, 10)}/${lastRunOn.slice(5, 7)}`;
}

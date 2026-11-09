import { LOSS_REASON_LABELS, LOSS_REASONS, type LossReason } from "./schemas";

/** "US$ 1,25". */
export function formatUsd(value: number): string {
  return `US$ ${value.toFixed(2).replace(".", ",")}`;
}

/**
 * `value` as a whole percent of `of`, or null without a base. Unlike `sharePercent` it may pass
 * 100%: deals closed in a period can outnumber the leads first contacted in it.
 */
export function ratePercent(value: number, of: number): number | null {
  if (of <= 0) return null;
  return Math.round((value / of) * 100);
}

/** "40%", or "—" without a base. */
export function percentLabel(value: number, of: number): string {
  const percent = ratePercent(value, of);
  return percent === null ? "—" : `${percent}%`;
}

/**
 * "12% · 3 de 25": of the leads first contacted in the period, how many closed (whenever they
 * closed), or "—" with nobody contacted. The deals closed in the period are a separate number.
 */
export function closingRateLabel(wonOfContacted: number, contacted: number): string {
  if (contacted <= 0) return "—";
  return `${percentLabel(wonOfContacted, contacted)} · ${wonOfContacted} de ${contacted}`;
}

/** Average deal in cents, or null with no deal. */
export function averageTicket(revenueCents: number, won: number): number | null {
  if (won <= 0) return null;
  return Math.round(revenueCents / won);
}

/** AI spend per deal closed, or null with no deal. */
export function costPerDeal(costUsd: number, won: number): number | null {
  if (won <= 0) return null;
  return costUsd / won;
}

export type LossCount = { reason: LossReason; count: number };

export type LossBar = {
  reason: LossReason;
  label: string;
  count: number;
  /** Of all losses in the period, in whole percent. */
  percent: number;
  /** Bar length against the most common reason, 0 to 1. */
  share: number;
};

/**
 * The reasons given in the period, most common first (ties keep the list order), with share and
 * bar length. Reasons nobody gave stay out, so the card lists only what happened.
 */
export function lossBreakdown(rows: readonly LossCount[]): { total: number; bars: LossBar[] } {
  const counts = new Map(rows.map((row) => [row.reason, row.count]));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(0, ...rows.map((row) => row.count));
  const bars = LOSS_REASONS.filter((reason) => (counts.get(reason) ?? 0) > 0).map((reason) => {
    const count = counts.get(reason) ?? 0;
    return {
      reason,
      label: LOSS_REASON_LABELS[reason],
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
      share: max > 0 ? count / max : 0,
    };
  });
  return { total, bars: bars.toSorted((a, b) => b.count - a.count) };
}

/** Losses of one niche by reason, as counted in SQL. */
export type NicheLossCount = { key: string; reason: LossReason; count: number };

/** Each niche's most common loss reason (ties keep the list order). */
export function topLossReasons(rows: readonly NicheLossCount[]): Map<string, LossReason> {
  const best = new Map<string, NicheLossCount>();
  for (const row of rows) {
    const current = best.get(row.key);
    if (current && !beats(row, current)) continue;
    best.set(row.key, row);
  }
  return new Map([...best].map(([key, row]) => [key, row.reason]));
}

function beats(row: NicheLossCount, current: NicheLossCount): boolean {
  if (row.count !== current.count) return row.count > current.count;
  return LOSS_REASONS.indexOf(row.reason) < LOSS_REASONS.indexOf(current.reason);
}

export type ReplyRate = { sent: number; replied: number };

/** "3 respostas em 40 envios". */
export function replyRateLabel({ sent, replied }: ReplyRate): string {
  const answers = replied === 1 ? "1 resposta" : `${replied} respostas`;
  const sends = sent === 1 ? "1 envio" : `${sent} envios`;
  return `${answers} em ${sends}`;
}

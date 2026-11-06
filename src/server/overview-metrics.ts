import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb, type Db } from "@/db/client";
import { localDay } from "@/lib/format";
import { monthOf, monthProjection, monthRange } from "@/lib/goal";
import { overviewPeriodSchema, periodRange, type OverviewPeriod } from "@/lib/period";
import { wonInRange } from "./goal-store";
import {
  aiCostBetween,
  firstEmailReplies,
  lossCounts,
  periodFunnel,
  sendingInRange,
} from "./metrics-store";

/** Everything the Visão geral measures over a period, plus the month's AI spend. */
export async function overviewMetrics(db: Db, period: OverviewPeriod, now: Date) {
  const range = periodRange(period, now);
  const today = localDay(now);
  const month = monthRange(monthOf(today));
  const monthSoFar = { ...month, toDay: today };
  const [funnel, sending, won, losses, authors, aiCostUsd, monthCostUsd, monthWon] =
    await Promise.all([
      periodFunnel(db, range),
      sendingInRange(db, range),
      wonInRange(db, range),
      lossCounts(db, range),
      firstEmailReplies(db, range),
      aiCostBetween(db, range),
      aiCostBetween(db, monthSoFar),
      wonInRange(db, month),
    ]);
  return {
    period,
    today,
    funnel,
    sending,
    business: {
      won: won.deals,
      revenueCents: won.revenueCents,
      lost: losses.reduce((sum, row) => sum + row.count, 0),
      aiCostUsd,
    },
    losses,
    authors,
    aiMonth: {
      costUsd: monthCostUsd,
      projectionUsd: monthProjection(monthCostUsd, today),
      won: monthWon.deals,
    },
  };
}

export type OverviewMetrics = Awaited<ReturnType<typeof overviewMetrics>>;

/** The period's metrics for the Visão geral (blocks, funnel, losses, AI × escrito à mão). */
export const getOverviewMetrics = createServerFn({ method: "GET" })
  .validator(z.object({ period: overviewPeriodSchema }))
  .handler(({ data }) => overviewMetrics(getDb(), data.period, new Date()));

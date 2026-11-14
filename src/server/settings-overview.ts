import { createServerFn } from "@tanstack/react-start";
import { count, desc, isNotNull } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { leads } from "@/db/schema";
import { localDay } from "@/lib/format";
import { monthOf, monthRange } from "@/lib/goal";
import { aiCostBetween } from "./metrics-store";
import { loadAutopilot } from "./settings-store";

/** How many unsubscribed addresses Configurações lists before "Ver os N descadastrados". */
export const UNSUBSCRIBED_SHOWN = 5;

/**
 * What the Configurações tabs read beyond the settings themselves, all read-only: the month's AI
 * spend, how many analyzed leads got each score (to show what a minimum score would
 * discard) and the latest unsubscribed leads.
 */
export async function loadSettingsOverview(db: Db, now: Date) {
  const today = localDay(now);
  const month = monthRange(monthOf(today));
  const [aiMonthUsd, autopilot, scores, latest, unsubscribed] = await Promise.all([
    aiCostBetween(db, { fromDay: month.fromDay, toDay: today }),
    loadAutopilot(db),
    db
      .select({ score: leads.score, leads: count() })
      .from(leads)
      .where(isNotNull(leads.score))
      .groupBy(leads.score),
    db
      .select({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        unsubscribedAt: leads.unsubscribedAt,
      })
      .from(leads)
      .where(isNotNull(leads.unsubscribedAt))
      .orderBy(desc(leads.unsubscribedAt))
      .limit(UNSUBSCRIBED_SHOWN),
    db.select({ value: count() }).from(leads).where(isNotNull(leads.unsubscribedAt)),
  ]);
  return {
    aiMonthUsd,
    // Brazil day of the last daily search, for "Última" and "Próxima" in Automação.
    dailySearchLastRunOn: autopilot.lastRunOn,
    scoreCounts: scores.flatMap((row) =>
      row.score === null ? [] : [{ score: row.score, leads: row.leads }],
    ),
    unsubscribed: {
      latest: latest.flatMap((row) =>
        row.unsubscribedAt ? [{ ...row, unsubscribedAt: row.unsubscribedAt }] : [],
      ),
      total: unsubscribed[0]?.value ?? 0,
    },
  };
}

export type SettingsOverview = Awaited<ReturnType<typeof loadSettingsOverview>>;

export const getSettingsOverview = createServerFn({ method: "GET" }).handler(() =>
  loadSettingsOverview(getDb(), new Date()),
);

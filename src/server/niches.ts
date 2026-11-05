import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Db } from "@/db/client";
import { leads } from "@/db/schema";
import { topLossReasons, type NicheLossCount } from "@/lib/overview-metrics";
import { overviewPeriodSchema, periodRange, type DayRange } from "@/lib/period";
import type { LossReason } from "@/lib/schemas";
import { cohortLost, cohortWon, FIRST_CONTACT } from "./metrics-store";

/**
 * A niche is the text typed on a search; "Dentistas" and " dentistas" are the same niche.
 * Leads belong to a niche through their search.
 */
const nicheKey = sql`lower(trim(s.niche))`;

/** Leads whose search has this niche (the key from listNiches). */
export function leadNicheIs(key: string) {
  return sql`${leads.searchId} in (select s.id from searches s where ${nicheKey} = ${key})`;
}

export type NicheRow = {
  key: string;
  label: string;
  leads: number;
  contacted: number;
  replied: number;
  closed: number;
  /** Of the contacted ones: replied and closed. The shares are taken from these, so they stay
   * within 100% (a lead closed on WhatsApp counts in `closed` but was never contacted here). */
  repliedContacted: number;
  closedContacted: number;
};

const sentTo = sql`exists(select 1 from emails e where e.lead_id = l.id and e.direction = 'out' and e.status = 'sent')`;
// Machine mail (out-of-office, auto-replies) is not a reply.
const wroteBack = sql`exists(select 1 from emails e where e.lead_id = l.id and e.direction = 'in' and e.automatic = 0)`;

/**
 * Every niche with its funnel: leads found, contacted by e-mail, that replied and that closed
 * (bought). The ones that close the most come first.
 */
export async function queryNiches(db: Db): Promise<NicheRow[]> {
  const rows = await db.all<NicheRow>(sql`
    select ${nicheKey} as key, max(trim(s.niche)) as label, count(*) as leads,
      sum(${sentTo}) as contacted,
      sum(${wroteBack}) as replied,
      sum(l.status = 'closed') as closed,
      sum(${sentTo} and ${wroteBack}) as repliedContacted,
      sum(${sentTo} and l.status = 'closed') as closedContacted
    from leads l inner join searches s on s.id = l.search_id
    group by key
    order by closed desc, replied desc, leads desc, label
  `);
  return rows.map(withNameLabel);
}

/** Searches are often typed in lowercase ("dentistas"); a niche reads as a name. */
function withNameLabel<Row extends { label: string }>(row: Row): Row {
  return { ...row, label: row.label.charAt(0).toUpperCase() + row.label.slice(1) };
}

export const listNiches = createServerFn({ method: "GET" }).handler(() => queryNiches(getDb()));

export type NicheMetricRow = {
  key: string;
  label: string;
  /** Leads found in the period. */
  leads: number;
  /** First e-mailed in the period, and of those, wrote back. */
  contacted: number;
  replied: number;
  /** Deals won (closed in the period) and their value; deals lost in the period. */
  won: number;
  revenueCents: number;
  lost: number;
  /**
   * Of the leads first contacted in the period, how many are now won and lost: the shares
   * ("mais fecha", "mais recusa", the % columns) come from these, never past 100%.
   */
  cohortWon: number;
  cohortLost: number;
  topLossReason: LossReason | null;
};

/**
 * Every niche with activity in the period: leads found, first contacted, replied, won (with
 * revenue) and lost, plus its most common loss reason. The ones that close the most first.
 */
export async function queryNicheMetrics(
  db: Db,
  range: Pick<DayRange, "from" | "to">,
): Promise<NicheMetricRow[]> {
  const from = Math.floor(range.from.getTime() / 1000);
  const to = Math.floor(range.to.getTime() / 1000);
  const contactedIn = sql`(f.at >= ${from} and f.at < ${to})`;
  const wonIn = sql`(l.status = 'closed' and l.closed_at >= ${from} and l.closed_at < ${to})`;
  const lostIn = sql`(l.status = 'discarded' and l.loss_reason is not null and l.lost_at >= ${from} and l.lost_at < ${to})`;
  const [rows, losses] = await Promise.all([
    db.all<Omit<NicheMetricRow, "topLossReason">>(sql`
      with ${FIRST_CONTACT}
      select * from (
        select ${nicheKey} as key, max(trim(s.niche)) as label,
          coalesce(sum(l.created_at >= ${from} and l.created_at < ${to}), 0) as leads,
          coalesce(sum(${contactedIn}), 0) as contacted,
          coalesce(sum(${contactedIn} and ${wroteBack}), 0) as replied,
          coalesce(sum(${wonIn}), 0) as won,
          coalesce(sum(case when ${wonIn} then coalesce(l.deal_value_cents, 0) else 0 end), 0)
            as revenueCents,
          coalesce(sum(${lostIn}), 0) as lost,
          coalesce(sum(${contactedIn} and ${cohortWon}), 0) as cohortWon,
          coalesce(sum(${contactedIn} and ${cohortLost}), 0) as cohortLost
        from leads l
        inner join searches s on s.id = l.search_id
        left join first_contact f on f.lead_id = l.id
        group by key
      )
      where leads + contacted + won + lost > 0
      order by won desc, revenueCents desc, replied desc, contacted desc, label`),
    db.all<NicheLossCount>(sql`
      select ${nicheKey} as key, l.loss_reason as reason, count(*) as count
      from leads l inner join searches s on s.id = l.search_id
      where ${lostIn}
      group by key, reason`),
  ]);
  const topReasons = topLossReasons(losses);
  return rows.map((row) =>
    withNameLabel({ ...row, topLossReason: topReasons.get(row.key) ?? null }),
  );
}

/** "Por nicho" on the Visão geral, for the chosen period. */
export const listNicheMetrics = createServerFn({ method: "GET" })
  .validator(z.object({ period: overviewPeriodSchema }))
  .handler(({ data }) => queryNicheMetrics(getDb(), periodRange(data.period, new Date())));

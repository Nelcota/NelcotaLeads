import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { leads } from "@/db/schema";

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
const wroteBack = sql`exists(select 1 from emails e where e.lead_id = l.id and e.direction = 'in')`;

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
  // Searches are often typed in lowercase ("dentistas"); a niche reads as a name.
  return rows.map((row) => ({
    ...row,
    label: row.label.charAt(0).toUpperCase() + row.label.slice(1),
  }));
}

export const listNiches = createServerFn({ method: "GET" }).handler(() => queryNiches(getDb()));

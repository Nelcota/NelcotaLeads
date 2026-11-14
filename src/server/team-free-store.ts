import { asc, desc, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads } from "@/db/schema";
import { freeLeadCondition, freeNewCondition } from "./team-stats-store";

/** Free leads the Equipe page lists; "Ver todos em Leads" shows the rest. */
export const FREE_LEADS_SHOWN = 5;

/** Replied first (someone is waiting), then contacted; newest first within each. */
const statusRank = sql`case ${leads.status} when 'replied' then 0 else 1 end`;

/**
 * When the lead last wrote to us (its latest real e-mail), as the Leads list reads it.
 * `last_email_at` alone also moves when the team sends, so it cannot say "respondeu há 2 h".
 */
const lastReplyAt = sql<number | null>`(
  select max(e.created_at) from emails e
  where e.lead_id = ${leads.id} and e.direction = 'in' and e.automatic = 0
)`;

/** The free leads the page shows, how many there are, and how many new ones wait for the dispatch. */
export async function freeLeads(db: Db) {
  const [rows, total, newCount] = await Promise.all([
    db
      .select({
        id: leads.id,
        name: leads.name,
        status: leads.status,
        score: leads.score,
        createdAt: leads.createdAt,
        lastEmailAt: leads.lastEmailAt,
        repliedAt: sql<number | null>`${lastReplyAt}`.mapWith((value: number | null) =>
          value === null ? null : new Date(value * 1000),
        ),
      })
      .from(leads)
      .where(freeLeadCondition)
      .orderBy(asc(statusRank), desc(leads.createdAt))
      .limit(FREE_LEADS_SHOWN),
    db.$count(leads, freeLeadCondition),
    db.$count(leads, freeNewCondition),
  ]);
  return { total, newCount, leads: rows };
}

/** The ids "Dividir igualmente" hands out, in the order the page lists them. */
export async function freeLeadIds(db: Db): Promise<string[]> {
  const rows = await db
    .select({ id: leads.id })
    .from(leads)
    .where(freeLeadCondition)
    .orderBy(asc(statusRank), desc(leads.createdAt));
  return rows.map((row) => row.id);
}

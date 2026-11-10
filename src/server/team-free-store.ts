import { asc, desc, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads } from "@/db/schema";
import { ASSIGN_LIMIT } from "@/lib/schemas";
import { freeLeadCondition, freeNewCondition } from "./team-stats-store";

/** Free leads the Equipe page lists; "Ver todos em Leads" shows the rest. */
export const FREE_LEADS_SHOWN = 5;

/** Replied first (someone is waiting), then contacted; newest first within each. */
const statusRank = sql`case ${leads.status} when 'replied' then 0 else 1 end`;

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
    .orderBy(asc(statusRank), desc(leads.createdAt))
    .limit(ASSIGN_LIMIT);
  return rows.map((row) => row.id);
}

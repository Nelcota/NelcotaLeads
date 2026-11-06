import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { leads, monthlyGoals } from "@/db/schema";
import { monthRange, type MonthlyGoalInput } from "@/lib/goal";
import type { DayRange } from "@/lib/period";

export type StoredGoal = { deals: number; revenueCents: number; month: string };

/**
 * The goal in force in `month`: its own row, or the latest earlier month's (a goal holds until
 * a new one is set). Null when no goal was ever set up to that month.
 */
export async function goalForMonth(db: Db, month: string): Promise<StoredGoal | null> {
  const row = await db
    .select({
      deals: monthlyGoals.deals,
      revenueCents: monthlyGoals.revenueCents,
      month: monthlyGoals.month,
    })
    .from(monthlyGoals)
    .where(lte(monthlyGoals.month, month))
    .orderBy(desc(monthlyGoals.month))
    .limit(1);
  return row[0] ?? null;
}

/** Sets the goal of `month` (the current one); earlier months keep the goal they had. */
export async function storeGoal(db: Db, month: string, goal: MonthlyGoalInput, now: Date) {
  await db
    .insert(monthlyGoals)
    .values({ month, ...goal, updatedAt: now })
    .onConflictDoUpdate({ target: monthlyGoals.month, set: { ...goal, updatedAt: now } });
}

/** Deals still won that closed within the range, and their value. */
export async function wonInRange(db: Db, range: Pick<DayRange, "from" | "to">) {
  const rows = await db
    .select({
      deals: sql<number>`count(*)`.mapWith(Number),
      revenueCents: sql<number>`coalesce(sum(${leads.dealValueCents}), 0)`.mapWith(Number),
    })
    .from(leads)
    .where(
      and(
        eq(leads.status, "closed"),
        gte(leads.closedAt, range.from),
        lt(leads.closedAt, range.to),
      ),
    );
  return { deals: rows[0]?.deals ?? 0, revenueCents: rows[0]?.revenueCents ?? 0 };
}

/** The month's goal (or the one it inherits) and what was won so far. */
export async function monthlyGoalStatus(db: Db, month: string) {
  const [goal, progress] = await Promise.all([
    goalForMonth(db, month),
    wonInRange(db, monthRange(month)),
  ]);
  return { month, goal, progress };
}

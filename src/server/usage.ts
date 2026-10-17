import { and, eq, like, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { apiUsage } from "@/db/schema";
import { localDay } from "@/lib/format";

export const GOOGLE_PLACES = "google_places";
export const DEEPSEEK = "deepseek";
export const DEFAULT_PLACES_DAILY_LIMIT = 50;

/**
 * Highest daily limit a variable may set. Above it the value is a typo ("5000000"), or one such
 * as "1e300" that passes Number.isInteger and later breaks the SQL LIMIT it reaches; either way
 * it is ignored in favor of the default, which only ever spends less.
 */
export const MAX_DAILY_LIMIT = 10_000;

/** A whole-number daily limit from an env var in [0, MAX_DAILY_LIMIT], or the default. */
export function dailyLimit(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  if (Number.isInteger(n) && n >= 0 && n <= MAX_DAILY_LIMIT) return n;
  console.warn(`daily limit "${value}" is not a whole number from 0 to ${MAX_DAILY_LIMIT}`);
  return fallback;
}

export function placesDailyLimit(value: string | undefined): number {
  return dailyLimit(value, DEFAULT_PLACES_DAILY_LIMIT);
}

/**
 * Atomically counts one request against today's limit.
 * Returns false (and counts nothing) when the limit is already reached.
 */
export async function reserveRequest(
  db: Db,
  provider: string,
  limit: number,
  now = new Date(),
): Promise<boolean> {
  if (limit <= 0) return false;
  const rows = await db
    .insert(apiUsage)
    .values({ day: localDay(now), provider, requests: 1 })
    .onConflictDoUpdate({
      target: [apiUsage.day, apiUsage.provider],
      set: { requests: sql`${apiUsage.requests} + 1` },
      setWhere: sql`${apiUsage.requests} < ${limit}`,
    })
    .returning({ requests: apiUsage.requests });
  return rows.length > 0;
}

/** Gives back one request reserved today (e.g. the call didn't happen); never below zero. */
export async function releaseRequest(db: Db, provider: string, now = new Date()) {
  await db
    .update(apiUsage)
    .set({ requests: sql`${apiUsage.requests} - 1` })
    .where(
      and(
        eq(apiUsage.day, localDay(now)),
        eq(apiUsage.provider, provider),
        sql`${apiUsage.requests} > 0`,
      ),
    );
}

export async function requestsToday(db: Db, provider: string, now = new Date()) {
  const row = await db.query.apiUsage.findFirst({
    where: and(eq(apiUsage.day, localDay(now)), eq(apiUsage.provider, provider)),
  });
  return row?.requests ?? 0;
}

/** Adds AI spend to today's row, so the dashboard can show the month's cost. */
export async function recordAiCost(db: Db, calls: number, costUsd: number, now = new Date()) {
  if (calls <= 0) return;
  await db
    .insert(apiUsage)
    .values({ day: localDay(now), provider: DEEPSEEK, requests: calls, costUsd })
    .onConflictDoUpdate({
      target: [apiUsage.day, apiUsage.provider],
      set: {
        requests: sql`${apiUsage.requests} + ${calls}`,
        costUsd: sql`${apiUsage.costUsd} + ${costUsd}`,
      },
    });
}

/** Google requests and AI cost in the current month (Brazil time). */
export async function usageThisMonth(db: Db, now = new Date()) {
  const rows = await db
    .select({
      provider: apiUsage.provider,
      requests: sql<number>`sum(${apiUsage.requests})`.mapWith(Number),
      costUsd: sql<number>`sum(${apiUsage.costUsd})`.mapWith(Number),
    })
    .from(apiUsage)
    .where(like(apiUsage.day, `${localDay(now).slice(0, 7)}-%`))
    .groupBy(apiUsage.provider);
  const google = rows.find((row) => row.provider === GOOGLE_PLACES);
  const ai = rows.find((row) => row.provider === DEEPSEEK);
  return { placesRequests: google?.requests ?? 0, aiCostUsd: ai?.costUsd ?? 0 };
}

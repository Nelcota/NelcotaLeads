import { and, eq, like, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { apiUsage } from "@/db/schema";
import { localDay } from "@/lib/format";

export const GOOGLE_PLACES = "google_places";
export const DEEPSEEK = "deepseek";
export const DEFAULT_PLACES_DAILY_LIMIT = 50;

export function placesDailyLimit(value: string | undefined): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isInteger(n) && n >= 0
    ? n
    : DEFAULT_PLACES_DAILY_LIMIT;
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

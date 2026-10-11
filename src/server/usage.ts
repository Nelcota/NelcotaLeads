import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { apiUsage } from "@/db/schema";
import { localDay } from "@/lib/format";

export const GOOGLE_PLACES = "google_places";
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

export async function requestsToday(db: Db, provider: string, now = new Date()) {
  const row = await db.query.apiUsage.findFirst({
    where: and(eq(apiUsage.day, localDay(now)), eq(apiUsage.provider, provider)),
  });
  return row?.requests ?? 0;
}

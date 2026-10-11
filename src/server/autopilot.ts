import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { searches } from "@/db/schema";
import { getAnalyzer, type LeadAnalyzer } from "@/lib/ai";
import { formatIsoLocal, localDay } from "@/lib/format";
import { getPlacesProvider, type PlacesProvider } from "@/lib/places";
import type { AutopilotTarget } from "@/lib/schemas";
import { runSearch } from "./collect";
import { draftFollowUps } from "./follow-ups";
import type { LeadJob } from "./queue";
import { loadAutopilot, writeAutopilot } from "./settings-store";
import { GOOGLE_PLACES, placesDailyLimit, recordAiCost, reserveRequest } from "./usage";

export type AutopilotDeps = {
  db: Db;
  queue: Queue<LeadJob>;
  places: PlacesProvider;
  analyzer: LeadAnalyzer;
};

/** Real dependencies from the Worker bindings; throws when an API key is missing. */
export function autopilotDeps(env: Env): AutopilotDeps {
  const db = getDb(env.DB);
  const limit = placesDailyLimit(env.PLACES_DAILY_REQUEST_LIMIT);
  return {
    db,
    queue: env.LEAD_QUEUE,
    places: getPlacesProvider(env.GOOGLE_PLACES_API_KEY, () =>
      reserveRequest(db, GOOGLE_PLACES, limit),
    ),
    analyzer: getAnalyzer(env),
  };
}

/**
 * The query for a target's next run and the target to store afterwards. The first run
 * searches the whole city; later runs walk its neighborhoods, because Google returns the
 * same top 60 places for the same query and those are already stored.
 */
export async function nextQuery(
  deps: Pick<AutopilotDeps, "db" | "analyzer">,
  target: AutopilotTarget,
): Promise<{ city: string; next: AutopilotTarget }> {
  if (target.cursor === 0) return { city: target.city, next: { ...target, cursor: 1 } };
  let areas = target.areas;
  if (areas.length === 0) {
    const result = await deps.analyzer.listAreas(target.city);
    await recordAiCost(deps.db, 1, result.usage.cost);
    areas = result.areas;
  }
  const area = areas.length > 0 ? areas[(target.cursor - 1) % areas.length] : undefined;
  return {
    city: area ? `${area}, ${target.city}` : target.city,
    next: { ...target, areas, cursor: target.cursor + 1 },
  };
}

/**
 * One autopilot tick. Searches every target once a day, from the configured hour on,
 * stopping when the Google daily limit runs out; then writes the reminders that are due.
 */
export async function runAutopilot(
  deps: AutopilotDeps,
  now = new Date(),
  { force = false } = {},
): Promise<{ searches: number; drafted: number }> {
  const { db } = deps;
  const config = await loadAutopilot(db);
  const today = localDay(now);
  const hour = Number(formatIsoLocal(now).slice(11, 13));
  const due = force || (config.enabled && hour >= config.hour && config.lastRunOn !== today);

  let searched = 0;
  if (due && config.targets.length > 0) {
    // Claim the day first so overlapping ticks do not search twice.
    await writeAutopilot(db, { autopilotLastRunOn: today });
    const targets = [...config.targets];
    for (const [index, target] of targets.entries()) {
      const { city, next } = await nextQuery(deps, target);
      targets[index] = next;
      const { searchId } = await runSearch(
        db,
        deps.queue,
        deps.places,
        { niche: target.niche, city, maxResults: config.results },
        "autopilot",
      );
      searched += 1;
      const search = await db.query.searches.findFirst({ where: eq(searches.id, searchId) });
      if (search?.status === "error" || search?.errorMessage) break;
    }
    await writeAutopilot(db, { autopilotTargets: targets });
  }

  const drafted = await draftFollowUps(deps, today);
  return { searches: searched, drafted };
}

import { eq } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { searches } from "@/db/schema";
import { getAnalyzer, type LeadAnalyzer } from "@/lib/ai";
import { formatIsoLocal, localDay } from "@/lib/format";
import { getPlacesProvider, type PlacesProvider } from "@/lib/places";
import type { AutopilotTarget } from "@/lib/schemas";
import { runSearch } from "./collect";
import type { LeadJob } from "./queue";
import { claimAutopilotDay, loadAutopilot, writeAutopilot } from "./settings-store";
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

export const ALREADY_RAN_MESSAGE =
  "As buscas de hoje já foram feitas. O piloto automático volta a buscar amanhã.";

/**
 * Searches every target once a day, from the configured hour on, stopping when the
 * Google daily limit runs out. `force` skips the schedule (hour and on/off switch) but
 * still runs at most once a day.
 */
export async function runAutopilot(
  deps: AutopilotDeps,
  now = new Date(),
  { force = false } = {},
): Promise<{ searches: number; alreadyRan: boolean }> {
  const { db } = deps;
  const config = await loadAutopilot(db);
  const today = localDay(now);
  const hour = Number(formatIsoLocal(now).slice(11, 13));
  const due = force || (config.enabled && hour >= config.hour && config.lastRunOn !== today);
  if (!due || config.targets.length === 0) return { searches: 0, alreadyRan: false };

  // Claim the day atomically so overlapping ticks (or a tick and "run now") never both search.
  if (!(await claimAutopilotDay(db, today))) return { searches: 0, alreadyRan: true };

  let searched = 0;
  const targets = [...config.targets];
  for (const [index, target] of targets.entries()) {
    try {
      const { city, next } = await nextQuery(deps, target);
      const { searchId } = await runSearch(
        db,
        deps.queue,
        deps.places,
        { niche: target.niche, city, maxResults: config.results },
        "autopilot",
      );
      searched += 1;
      // Saved right away, so a later failure never repeats this target's area tomorrow.
      targets[index] = next;
      await writeAutopilot(db, { autopilotTargets: targets });
      const search = await db.query.searches.findFirst({ where: eq(searches.id, searchId) });
      if (search?.status === "error" || search?.errorMessage) break;
    } catch (error) {
      // One broken target must not keep the others from running.
      console.error("autopilot target failed", target.niche, target.city, error);
    }
  }

  return { searches: searched, alreadyRan: false };
}

import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { searches } from "@/db/schema";
import { getPlacesProvider } from "@/lib/places";
import { newSearchSchema } from "@/lib/schemas";
import { runSearch } from "./collect";
import { loadSettings } from "./settings-store";
import { GOOGLE_PLACES, placesDailyLimit, requestsToday, reserveRequest } from "./usage";

export const createSearch = createServerFn({ method: "POST" })
  .validator(newSearchSchema)
  .handler(({ data }) => {
    if (!env.DEEPSEEK_API_KEY) throw new Error("Configure a DEEPSEEK_API_KEY antes de buscar.");
    const db = getDb();
    const limit = placesDailyLimit(env.PLACES_DAILY_REQUEST_LIMIT);
    const provider = getPlacesProvider(env.GOOGLE_PLACES_API_KEY, () =>
      reserveRequest(db, GOOGLE_PLACES, limit),
    );
    return runSearch(db, env.LEAD_QUEUE, provider, data);
  });

export const listSearches = createServerFn({ method: "GET" }).handler(() =>
  getDb().query.searches.findMany({ orderBy: desc(searches.createdAt), limit: 100 }),
);

export const getSearch = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const search = await getDb().query.searches.findFirst({ where: eq(searches.id, data.id) });
    if (!search) throw new Error("Busca não encontrada");
    return search;
  });

/** What the search form needs to know before letting a search start. */
export const getProviderStatus = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const settings = await loadSettings(db);
  return {
    placesConfigured: Boolean(env.GOOGLE_PLACES_API_KEY),
    aiConfigured: Boolean(env.DEEPSEEK_API_KEY),
    offerConfigured: settings.offer.length > 0,
    placesUsage: {
      used: await requestsToday(db, GOOGLE_PLACES),
      limit: placesDailyLimit(env.PLACES_DAILY_REQUEST_LIMIT),
    },
  };
});

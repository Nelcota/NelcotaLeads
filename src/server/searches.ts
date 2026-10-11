import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { searches } from "@/db/schema";
import { getPlacesProvider } from "@/lib/places";
import { newSearchSchema } from "@/lib/schemas";
import { runSearch } from "./collect";
import { GOOGLE_PLACES, placesDailyLimit, requestsToday, reserveRequest } from "./usage";

export const createSearch = createServerFn({ method: "POST" })
  .inputValidator(newSearchSchema)
  .handler(({ data }) => {
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
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }) => {
    const search = await getDb().query.searches.findFirst({ where: eq(searches.id, data.id) });
    if (!search) throw new Error("Busca não encontrada");
    return search;
  });

export const getProviderStatus = createServerFn({ method: "GET" }).handler(async () => ({
  places: env.GOOGLE_PLACES_API_KEY ? ("google" as const) : ("mock" as const),
  ai: env.DEEPSEEK_API_KEY ? ("deepseek" as const) : ("mock" as const),
  placesUsage: {
    used: await requestsToday(getDb(), GOOGLE_PLACES),
    limit: placesDailyLimit(env.PLACES_DAILY_REQUEST_LIMIT),
  },
}));

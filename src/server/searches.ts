import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { searches } from "@/db/schema";
import { getPlacesProvider } from "@/lib/places";
import { idSchema, newSearchSchema } from "@/lib/schemas";
import { mailConfigured } from "@/lib/mail";
import { needsAttention } from "@/lib/system-status";
import { runSearch } from "./collect";
import { cancelSearch as stopSearch } from "./search-actions";
import { loadSystemStatus } from "./job-runs";
import { EMAIL_PROVIDER, mailDailyLimit } from "./mail-flow";
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
  .validator(z.object({ id: idSchema }))
  .handler(async ({ data }) => {
    const search = await getDb().query.searches.findFirst({ where: eq(searches.id, data.id) });
    if (!search) throw new Error("Busca não encontrada");
    return search;
  });

/** Stops a running search; see cancelSearch for what is kept. */
export const cancelSearch = createServerFn({ method: "POST" })
  .validator(z.object({ id: idSchema }))
  .handler(({ data }) => stopSearch(getDb(), data.id));

export const getProviderStatus = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const now = new Date();
  const [settings, placesUsed, mailSent, jobs] = await Promise.all([
    loadSettings(db),
    requestsToday(db, GOOGLE_PLACES),
    requestsToday(db, EMAIL_PROVIDER),
    loadSystemStatus(db, { mailConfigured: mailConfigured(env), now }),
  ]);
  return {
    placesConfigured: Boolean(env.GOOGLE_PLACES_API_KEY),
    aiConfigured: Boolean(env.DEEPSEEK_API_KEY),
    offerConfigured: settings.offer.length > 0,
    placesUsage: {
      used: placesUsed,
      limit: placesDailyLimit(env.PLACES_DAILY_REQUEST_LIMIT),
    },
    mail: {
      configured: mailConfigured(env),
      address: (env.MAIL_ADDRESS ?? "").toLowerCase(),
      sentToday: mailSent,
      limit: mailDailyLimit(env.MAIL_DAILY_LIMIT),
    },
    // The orange dot on Conta in the sidebar: a background task keeps failing.
    systemAttention: needsAttention(jobs, now),
  };
});

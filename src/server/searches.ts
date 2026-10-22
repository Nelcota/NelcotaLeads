import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, type Db } from "@/db/client";
import { searches } from "@/db/schema";
import { getPlacesProvider } from "@/lib/places";
import { idSchema, newSearchSchema, type NewSearchInput } from "@/lib/schemas";
import { mailConfigured } from "@/lib/mail";
import { needsAttention } from "@/lib/system-status";
import { runSearch } from "./collect";
import {
  cancelSearch as stopSearch,
  querySearches,
  searchInputOf,
  setSearchHidden,
} from "./search-actions";
import { CRON_RUNS, loadSystemStatus } from "./job-runs";
import { EMAIL_PROVIDER, mailDailyLimit } from "./mail-flow";
import { loadConfig } from "./settings-store";
import { GOOGLE_PLACES, placesDailyLimit, requestsToday, reserveRequest } from "./usage";

// Google returns up to 20 places per request.
const PLACES_PAGE_SIZE = 20;

export const createSearch = createServerFn({ method: "POST" })
  .validator(newSearchSchema)
  .handler(({ data }) => startSearch(getDb(), data));

/** "Tentar de novo" and "Repetir": a new search with the same niche, city and size. */
export const repeatSearch = createServerFn({ method: "POST" })
  .validator(z.object({ id: idSchema }))
  .handler(async ({ data }) => {
    const db = getDb();
    return startSearch(db, await searchInputOf(db, data.id));
  });

/** Same checks as the Nova busca dialog: the keys, then today's Google requests. */
async function startSearch(db: Db, input: NewSearchInput) {
  if (!env.DEEPSEEK_API_KEY || !env.GOOGLE_PLACES_API_KEY) {
    throw new Error(
      "As chaves do Google e da IA não estão configuradas. Fale com quem administra o sistema.",
    );
  }
  const limit = placesDailyLimit(env.PLACES_DAILY_REQUEST_LIMIT);
  const remaining = limit - (await requestsToday(db, GOOGLE_PLACES));
  if (remaining < Math.ceil(input.maxResults / PLACES_PAGE_SIZE)) {
    throw new Error(
      remaining <= 0
        ? `O limite de ${limit} requisições ao Google por dia foi atingido. Volte amanhã.`
        : `Restam só ${remaining} ${remaining === 1 ? "requisição" : "requisições"} ao Google hoje.`,
    );
  }
  const provider = getPlacesProvider(env.GOOGLE_PLACES_API_KEY, () =>
    reserveRequest(db, GOOGLE_PLACES, limit),
  );
  return runSearch(db, env.LEAD_QUEUE, provider, input);
}

export const listSearches = createServerFn({ method: "GET" }).handler(() => querySearches(getDb()));

/** "Ocultar" in the card's menu, and its "Desfazer". */
export const hideSearch = createServerFn({ method: "POST" })
  .validator(z.object({ id: idSchema, hidden: z.boolean() }))
  .handler(({ data }) => setSearchHidden(getDb(), data.id, data.hidden));

/** Stops a running search; see cancelSearch for what is kept. */
export const cancelSearch = createServerFn({ method: "POST" })
  .validator(z.object({ id: idSchema }))
  .handler(({ data }) => stopSearch(getDb(), data.id));

/** For /searches/<id> links: whether that search still exists. */
export const searchExists = createServerFn({ method: "GET" })
  .validator(z.object({ id: idSchema }))
  .handler(async ({ data }) => (await getDb().$count(searches, eq(searches.id, data.id))) > 0);

export const getProviderStatus = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const now = new Date();
  // One read of the settings row, shared with the system status.
  const config = loadConfig(db);
  const [{ settings }, placesUsed, mailSent, jobs] = await Promise.all([
    config,
    requestsToday(db, GOOGLE_PLACES),
    requestsToday(db, EMAIL_PROVIDER),
    loadSystemStatus(db, {
      mailConfigured: mailConfigured(env),
      now,
      config,
      scheduled: CRON_RUNS,
    }),
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

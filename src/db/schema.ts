import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ScoringCriterion, SiteData } from "@/lib/schemas";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
};

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey(),
  offer: text("offer").notNull().default(""),
  idealCustomer: text("ideal_customer").notNull().default(""),
  criteria: text("criteria", { mode: "json" }).$type<ScoringCriterion[]>().notNull(),
  tone: text("tone", { enum: ["formal", "consultivo", "direto"] })
    .notNull()
    .default("consultivo"),
  senderName: text("sender_name").notNull().default(""),
  senderCompany: text("sender_company").notNull().default(""),
  messageScoreThreshold: integer("message_score_threshold").notNull().default(60),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const SEARCH_STATUSES = ["collecting", "analyzing", "done", "error"] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];

export const searches = sqliteTable("searches", {
  id: text("id").primaryKey(),
  niche: text("niche").notNull(),
  city: text("city").notNull(),
  maxResults: integer("max_results").notNull(),
  status: text("status", { enum: SEARCH_STATUSES }).notNull().default("collecting"),
  foundCount: integer("found_count").notNull().default(0),
  analyzedCount: integer("analyzed_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorMessage: text("error_message"),
  ...timestamps,
});

export const LEAD_STATUSES = ["new", "contacted", "replied", "closed", "discarded"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SITE_STATUSES = ["pending", "none", "ok", "unreachable", "blocked"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export const ANALYSIS_STATUSES = ["pending", "done", "error"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    searchId: text("search_id")
      .notNull()
      .references(() => searches.id),
    placeId: text("place_id").notNull().unique(),
    name: text("name").notNull(),
    address: text("address"),
    city: text("city"),
    phone: text("phone"),
    phoneE164: text("phone_e164"),
    website: text("website"),
    rating: real("rating"),
    reviewCount: integer("review_count"),
    mapsUrl: text("maps_url"),
    businessStatus: text("business_status"),
    siteStatus: text("site_status", { enum: SITE_STATUSES }).notNull().default("pending"),
    siteTextExcerpt: text("site_text_excerpt"),
    siteData: text("site_data", { mode: "json" }).$type<SiteData>(),
    analysisStatus: text("analysis_status", { enum: ANALYSIS_STATUSES })
      .notNull()
      .default("pending"),
    analysisError: text("analysis_error"),
    // Denormalized from the latest analysis so the list can sort/filter without a join.
    score: integer("score"),
    status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
    notes: text("notes").notNull().default(""),
    ...timestamps,
  },
  (t) => [index("leads_search_idx").on(t.searchId), index("leads_score_idx").on(t.score)],
);

export const analyses = sqliteTable(
  "analyses",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    summary: text("summary").notNull(),
    signals: text("signals", { mode: "json" }).$type<string[]>().notNull(),
    painPoints: text("pain_points", { mode: "json" }).$type<string[]>().notNull(),
    score: integer("score").notNull(),
    scoreReasoning: text("score_reasoning").notNull(),
    firstMessage: text("first_message"),
    model: text("model").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    costEstimate: real("cost_estimate").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("analyses_lead_idx").on(t.leadId)],
);

export type Settings = typeof settings.$inferSelect;
export type Search = typeof searches.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;

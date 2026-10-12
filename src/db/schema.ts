import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  LEAD_STATUS_VALUES,
  type AutopilotTarget,
  type ScoringCriterion,
  type SiteData,
} from "@/lib/schemas";

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
  // Leads scoring below this are discarded by the AI (0 keeps everything).
  minScore: integer("min_score").notNull().default(30),
  autopilotEnabled: integer("autopilot_enabled", { mode: "boolean" }).notNull().default(false),
  // Hour of the day (Brazil time) when the daily searches run.
  autopilotHour: integer("autopilot_hour").notNull().default(8),
  autopilotResults: integer("autopilot_results").notNull().default(20),
  autopilotTargets: text("autopilot_targets", { mode: "json" })
    .$type<AutopilotTarget[]>()
    .notNull()
    .default(sql`'[]'`),
  autopilotLastRunOn: text("autopilot_last_run_on"),
  // The AI answers replies on its own until someone shows interest.
  aiAutoReply: integer("ai_auto_reply", { mode: "boolean" }).notNull().default(true),
  // New leads with an e-mail go into the send queue without a manual selection.
  autoDispatch: integer("auto_dispatch", { mode: "boolean" }).notNull().default(false),
  // IMAP position: messages above this UID in this mailbox were not read yet.
  mailUidValidity: integer("mail_uid_validity").notNull().default(0),
  mailLastUid: integer("mail_last_uid").notNull().default(0),
  // Unix seconds; session tokens issued before this were signed out (logout ends every session).
  sessionsValidFrom: integer("sessions_valid_from").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const SEARCH_STATUSES = ["collecting", "analyzing", "done", "error"] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];

export const searches = sqliteTable(
  "searches",
  {
    id: text("id").primaryKey(),
    niche: text("niche").notNull(),
    city: text("city").notNull(),
    maxResults: integer("max_results").notNull(),
    status: text("status", { enum: SEARCH_STATUSES }).notNull().default("collecting"),
    foundCount: integer("found_count").notNull().default(0),
    analyzedCount: integer("analyzed_count").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    // Places already stored by a previous search (unique place_id), so not re-collected.
    duplicateCount: integer("duplicate_count").notNull().default(0),
    placesRequests: integer("places_requests").notNull().default(0),
    errorMessage: text("error_message"),
    origin: text("origin", { enum: ["manual", "autopilot"] })
      .notNull()
      .default("manual"),
    ...timestamps,
  },
  (t) => [index("searches_created_idx").on(t.createdAt)],
);

export const LEAD_STATUSES = LEAD_STATUS_VALUES;
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
    // When a queue job claimed the analysis; a stale claim may be taken over after a crash.
    analysisStartedAt: integer("analysis_started_at", { mode: "timestamp" }),
    // When a re-analysis was last queued; a pending lead older than this may be queued again.
    analysisQueuedAt: integer("analysis_queued_at", { mode: "timestamp" }),
    // Denormalized from the latest analysis so the list can sort/filter without a join.
    score: integer("score"),
    status: text("status", { enum: LEAD_STATUSES }).notNull().default("new"),
    notes: text("notes").notNull().default(""),
    contactedAt: integer("contacted_at", { mode: "timestamp" }),
    // Day to follow up (YYYY-MM-DD, Brazil time); compared as text against today.
    followUpOn: text("follow_up_on"),
    // First business e-mail found on the site; the address the outreach goes to.
    email: text("email"),
    // False once a person takes over the conversation (or the AI hands it over).
    aiMode: integer("ai_mode", { mode: "boolean" }).notNull().default(true),
    // Why the AI stopped and asked for a person, e.g. the lead asked for a price.
    handoffReason: text("handoff_reason"),
    unsubscribedAt: integer("unsubscribed_at", { mode: "timestamp" }),
    emailFollowUps: integer("email_follow_ups").notNull().default(0),
    lastEmailAt: integer("last_email_at", { mode: "timestamp" }),
    // Set when the AI discarded the lead during triage.
    discardReason: text("discard_reason"),
    discardedAt: integer("discarded_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => [
    index("leads_search_idx").on(t.searchId),
    index("leads_score_idx").on(t.score),
    index("leads_status_idx").on(t.status, t.followUpOn),
    index("leads_email_idx").on(t.email),
    index("leads_last_email_idx").on(t.lastEmailAt),
  ],
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
  (t) => [index("analyses_lead_idx").on(t.leadId, t.createdAt)],
);

export const EMAIL_STATUSES = ["draft", "queued", "sent", "failed", "received"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];
export type EmailAuthor = "ai" | "user" | "lead";

/** Every e-mail of a lead's conversation: drafts, the send queue, sent and received. */
export const emails = sqliteTable(
  "emails",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: ["out", "in"] }).notNull(),
    status: text("status", { enum: EMAIL_STATUSES }).notNull(),
    author: text("author", { enum: ["ai", "user", "lead"] }).notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    // RFC 5322 Message-ID; replies are matched through In-Reply-To / References.
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),
    sendAfter: integer("send_after", { mode: "timestamp" }),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    error: text("error"),
    ...timestamps,
  },
  (t) => [
    index("emails_lead_idx").on(t.leadId),
    index("emails_status_idx").on(t.status, t.sendAfter),
    // One row per Message-ID, so a reply read twice (overlapping polls) is stored once.
    uniqueIndex("emails_message_idx")
      .on(t.messageId)
      .where(sql`${t.messageId} is not null`),
    index("emails_sent_idx").on(t.sentAt),
  ],
);

/** Paid API calls per day (Brazil time), used to enforce daily limits. */
export const apiUsage = sqliteTable(
  "api_usage",
  {
    day: text("day").notNull(),
    provider: text("provider").notNull(),
    requests: integer("requests").notNull().default(0),
    costUsd: real("cost_usd").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.provider] })],
);

export type Settings = typeof settings.$inferSelect;
export type Search = typeof searches.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Email = typeof emails.$inferSelect;

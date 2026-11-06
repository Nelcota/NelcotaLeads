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
  LOSS_REASONS,
  MEETING_KINDS,
  SALES_STAGES,
  type ProposalItem,
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
  // Sending window (Brazil hours): e-mails go out from sendWindowStart:00 until sendWindowEnd:00.
  sendWindowStart: integer("send_window_start").notNull().default(6),
  sendWindowEnd: integer("send_window_end").notNull().default(18),
  // Set while the day's run is paused: queued e-mails wait until someone resumes it.
  dispatchPausedAt: integer("dispatch_paused_at", { mode: "timestamp" }),
  // Brazil day (YYYY-MM-DD) whose cold run "Cancelar disparo" stopped; another day ignores it.
  dispatchCancelledOn: text("dispatch_cancelled_on"),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

// `cancelled`: stopped by the user; what was collected and analyzed so far stays.
export const SEARCH_STATUSES = ["collecting", "analyzing", "done", "error", "cancelled"] as const;
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
    // Hidden from the Buscas list by the user; its leads stay (and keep pointing here).
    hiddenAt: integer("hidden_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => [index("searches_created_idx").on(t.createdAt)],
);

export const LEAD_STATUSES = LEAD_STATUS_VALUES;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const SITE_STATUSES = ["pending", "none", "ok", "unreachable", "blocked"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

// `skipped`: not analyzed on purpose (its search was cancelled, or a manual lead without a
// site); "Reanalisar" still works.
export const ANALYSIS_STATUSES = ["pending", "done", "error", "skipped"] as const;
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
    // Where a replied lead is in the sale: a meeting booked, then a proposal sent.
    salesStage: text("sales_stage", { enum: SALES_STAGES }),
    // Who took the lead; null while it is free.
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    // A won deal: when, how much and what was sold.
    closedAt: integer("closed_at", { mode: "timestamp" }),
    dealValueCents: integer("deal_value_cents"),
    dealService: text("deal_service"),
    // A lost deal: the reason from the fixed list, an optional note and when.
    lossReason: text("loss_reason", { enum: LOSS_REASONS }),
    lossNote: text("loss_note"),
    lostAt: integer("lost_at", { mode: "timestamp" }),
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

// `cancelled`: stopped on purpose (the lead answered, the conversation ended); `failed`: the send broke.
export const EMAIL_STATUSES = [
  "draft",
  "queued",
  "sent",
  "failed",
  "cancelled",
  "received",
] as const;
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
    // The provider sent it back (a bounce report matched this e-mail): it never arrived.
    bouncedAt: integer("bounced_at", { mode: "timestamp" }),
    // Received from a machine (out-of-office, auto-reply, unmatched bounce): kept in the thread,
    // but never counted as a reply nor answered.
    automatic: integer("automatic", { mode: "boolean" }).notNull().default(false),
    // An AI answer in a conversation whose message had no id to thread on: never cold outreach.
    conversationReply: integer("conversation_reply", { mode: "boolean" }).notNull().default(false),
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

/**
 * Local accounts that can sign in. `sessionVersion` is part of every session token, so bumping
 * it (a password reset) signs that account out everywhere. Signing out ends one session only
 * (see `revokedSessions`).
 */
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    /** Profile photo as a small `data:image/...` URL, resized in the browser before upload. */
    avatar: text("avatar"),
    sessionVersion: integer("session_version").notNull().default(1),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/**
 * Sessions ended by signing out. Each token carries a session id that survives renewal, so
 * signing out voids that browser's cookie (and any copy of it) without touching the others.
 * A row is only needed until the last token it covers could have expired.
 */
export const revokedSessions = sqliteTable("revoked_sessions", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});

/**
 * The user's canned answers ("Respostas rápidas"), inserted into a reply from the composer.
 * Its own table, so the settings row (read by every tick) never depends on it.
 */
export const quickReplies = sqliteTable("quick_replies", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  position: integer("position").notNull(),
  ...timestamps,
});

/**
 * One row per background task (the cron steps and the analysis queue): when it last ran,
 * worked and failed, so Conta → Status can tell the user without opening the logs.
 * `lastError` is the friendly text; the raw error only goes to the log.
 */
export const jobRuns = sqliteTable("job_runs", {
  job: text("job").primaryKey(),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }).notNull(),
  lastOkAt: integer("last_ok_at", { mode: "timestamp" }),
  lastErrorAt: integer("last_error_at", { mode: "timestamp" }),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
});

/**
 * What happened to a lead and when: status and stage changes, who took it, the deal won or
 * lost, meetings and proposals. The source for the history in the lead and the metrics.
 */
export const LEAD_EVENT_KINDS = [
  "status",
  "stage",
  "owner",
  "won",
  "lost",
  "meeting",
  "proposal",
] as const;
export type LeadEventKind = (typeof LEAD_EVENT_KINDS)[number];

export const leadEvents = sqliteTable(
  "lead_events",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: LEAD_EVENT_KINDS }).notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("lead_events_lead_idx").on(t.leadId, t.createdAt),
    index("lead_events_kind_idx").on(t.kind, t.createdAt),
  ],
);

/** Meetings booked with a lead; the Agenda and "Agenda de hoje" read them. */
export const meetings = sqliteTable(
  "meetings",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
    kind: text("kind", { enum: MEETING_KINDS }).notNull(),
    note: text("note").notNull().default(""),
    // The invite e-mail queued for the lead, when one was sent.
    inviteEmailId: text("invite_email_id"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => [index("meetings_starts_idx").on(t.startsAt), index("meetings_lead_idx").on(t.leadId)],
);

/** The fixed service table proposals are built from. Prices in cents (R$). */
export const services = sqliteTable("services", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  detail: text("detail").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  // Days to deliver; null for monthly services.
  deadlineDays: integer("deadline_days"),
  monthly: integer("monthly", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull(),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  ...timestamps,
});

/** Priced extras offered with any service in a proposal. */
export const serviceAddons = sqliteTable("service_addons", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  scope: text("scope").notNull().default("Todos os sites"),
  priceCents: integer("price_cents").notNull(),
  monthly: integer("monthly", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull(),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  ...timestamps,
});

/**
 * A proposal sent to a lead. The items are copied from the table when it is built, so a
 * later price change does not rewrite what the client received.
 */
export const proposals = sqliteTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    items: text("items", { mode: "json" }).$type<ProposalItem[]>().notNull(),
    totalCents: integer("total_cents").notNull(),
    validDays: integer("valid_days").notNull().default(15),
    emailId: text("email_id"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("proposals_lead_idx").on(t.leadId, t.createdAt)],
);

/** The team's goal for one month (`YYYY-MM`); a month keeps the goal it had. */
export const monthlyGoals = sqliteTable("monthly_goals", {
  month: text("month").primaryKey(),
  deals: integer("deals").notNull(),
  revenueCents: integer("revenue_cents").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/** E-mails allowed to create an account; only invited addresses can join the team. */
export const invites = sqliteTable(
  "invites",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    invitedBy: text("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: integer("accepted_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("invites_email_idx").on(t.email)],
);

export type Settings = typeof settings.$inferSelect;
export type Search = typeof searches.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Email = typeof emails.$inferSelect;
export type User = typeof users.$inferSelect;
export type QuickReply = typeof quickReplies.$inferSelect;
export type JobRun = typeof jobRuns.$inferSelect;
export type LeadEvent = typeof leadEvents.$inferSelect;
export type Meeting = typeof meetings.$inferSelect;
export type Service = typeof services.$inferSelect;
export type ServiceAddon = typeof serviceAddons.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type MonthlyGoal = typeof monthlyGoals.$inferSelect;
export type Invite = typeof invites.$inferSelect;

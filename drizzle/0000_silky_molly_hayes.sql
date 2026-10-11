CREATE TABLE `analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`summary` text NOT NULL,
	`signals` text NOT NULL,
	`pain_points` text NOT NULL,
	`score` integer NOT NULL,
	`score_reasoning` text NOT NULL,
	`first_message` text,
	`model` text NOT NULL,
	`tokens_in` integer DEFAULT 0 NOT NULL,
	`tokens_out` integer DEFAULT 0 NOT NULL,
	`cost_estimate` real DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `analyses_lead_idx` ON `analyses` (`lead_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`search_id` text NOT NULL,
	`place_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`city` text,
	`phone` text,
	`phone_e164` text,
	`website` text,
	`rating` real,
	`review_count` integer,
	`maps_url` text,
	`business_status` text,
	`site_status` text DEFAULT 'pending' NOT NULL,
	`site_text_excerpt` text,
	`site_data` text,
	`analysis_status` text DEFAULT 'pending' NOT NULL,
	`analysis_error` text,
	`score` integer,
	`status` text DEFAULT 'new' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`search_id`) REFERENCES `searches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_place_id_unique` ON `leads` (`place_id`);--> statement-breakpoint
CREATE INDEX `leads_search_idx` ON `leads` (`search_id`);--> statement-breakpoint
CREATE INDEX `leads_score_idx` ON `leads` (`score`);--> statement-breakpoint
CREATE TABLE `searches` (
	`id` text PRIMARY KEY NOT NULL,
	`niche` text NOT NULL,
	`city` text NOT NULL,
	`max_results` integer NOT NULL,
	`status` text DEFAULT 'collecting' NOT NULL,
	`found_count` integer DEFAULT 0 NOT NULL,
	`analyzed_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`offer` text DEFAULT '' NOT NULL,
	`ideal_customer` text DEFAULT '' NOT NULL,
	`criteria` text NOT NULL,
	`tone` text DEFAULT 'consultivo' NOT NULL,
	`sender_name` text DEFAULT '' NOT NULL,
	`sender_company` text DEFAULT '' NOT NULL,
	`message_score_threshold` integer DEFAULT 60 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);

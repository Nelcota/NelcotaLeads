ALTER TABLE `api_usage` ADD `cost_usd` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `follow_up_message` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `follow_up_message_for` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `discard_reason` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `discarded_at` integer;--> statement-breakpoint
ALTER TABLE `searches` ADD `origin` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `min_score` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `autopilot_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `autopilot_hour` integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `autopilot_results` integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `autopilot_targets` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `autopilot_last_run_on` text;
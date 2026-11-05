CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`invited_by` text,
	`accepted_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_email_idx` ON `invites` (`email`);--> statement-breakpoint
CREATE TABLE `lead_events` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`kind` text NOT NULL,
	`from_value` text,
	`to_value` text,
	`user_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `lead_events_lead_idx` ON `lead_events` (`lead_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `lead_events_kind_idx` ON `lead_events` (`kind`,`created_at`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`kind` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`invite_email_id` text,
	`created_by` text,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `meetings_starts_idx` ON `meetings` (`starts_at`);--> statement-breakpoint
CREATE INDEX `meetings_lead_idx` ON `meetings` (`lead_id`);--> statement-breakpoint
CREATE TABLE `monthly_goals` (
	`month` text PRIMARY KEY NOT NULL,
	`deals` integer NOT NULL,
	`revenue_cents` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`items` text NOT NULL,
	`total_cents` integer NOT NULL,
	`valid_days` integer DEFAULT 15 NOT NULL,
	`email_id` text,
	`sent_at` integer,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `proposals_lead_idx` ON `proposals` (`lead_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `service_addons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`scope` text DEFAULT 'Todos os sites' NOT NULL,
	`price_cents` integer NOT NULL,
	`monthly` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`price_cents` integer NOT NULL,
	`deadline_days` integer,
	`monthly` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	`archived_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `emails` ADD `bounced_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `sales_stage` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `owner_id` text REFERENCES users(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `closed_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `deal_value_cents` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `deal_service` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `loss_reason` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `loss_note` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `lost_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `send_window_start` integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `send_window_end` integer DEFAULT 18 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `dispatch_paused_at` integer;
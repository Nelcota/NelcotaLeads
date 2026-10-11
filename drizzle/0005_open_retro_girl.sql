CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`direction` text NOT NULL,
	`status` text NOT NULL,
	`author` text NOT NULL,
	`from_address` text NOT NULL,
	`to_address` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`message_id` text,
	`in_reply_to` text,
	`send_after` integer,
	`sent_at` integer,
	`error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `emails_lead_idx` ON `emails` (`lead_id`);--> statement-breakpoint
CREATE INDEX `emails_status_idx` ON `emails` (`status`,`send_after`);--> statement-breakpoint
CREATE INDEX `emails_message_idx` ON `emails` (`message_id`);--> statement-breakpoint
ALTER TABLE `leads` ADD `email` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `ai_mode` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `handoff_reason` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `unsubscribed_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `email_follow_ups` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `last_email_at` integer;--> statement-breakpoint
ALTER TABLE `settings` ADD `ai_auto_reply` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `auto_dispatch` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `mail_uid_validity` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `mail_last_uid` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `leads` SET `email` = lower(json_extract(`site_data`, '$.emails[0]')) WHERE `email` IS NULL AND `site_data` IS NOT NULL;
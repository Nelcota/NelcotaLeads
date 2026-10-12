DROP INDEX `analyses_lead_idx`;--> statement-breakpoint
CREATE INDEX `analyses_lead_idx` ON `analyses` (`lead_id`,`created_at`);--> statement-breakpoint
DROP INDEX `emails_message_idx`;--> statement-breakpoint
CREATE INDEX `emails_sent_idx` ON `emails` (`sent_at`);--> statement-breakpoint
-- Keep the oldest copy of any reply stored twice before Message-IDs became unique.
DELETE FROM `emails` WHERE `message_id` IS NOT NULL AND `rowid` NOT IN (SELECT min(`rowid`) FROM `emails` WHERE `message_id` IS NOT NULL GROUP BY `message_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `emails_message_idx` ON `emails` (`message_id`) WHERE "emails"."message_id" is not null;--> statement-breakpoint
DROP INDEX `leads_status_idx`;--> statement-breakpoint
ALTER TABLE `leads` ADD `analysis_started_at` integer;--> statement-breakpoint
CREATE INDEX `leads_email_idx` ON `leads` (`email`);--> statement-breakpoint
CREATE INDEX `leads_last_email_idx` ON `leads` (`last_email_at`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`,`follow_up_on`);--> statement-breakpoint
CREATE INDEX `searches_created_idx` ON `searches` (`created_at`);
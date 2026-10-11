ALTER TABLE `leads` ADD `contacted_at` integer;--> statement-breakpoint
ALTER TABLE `leads` ADD `follow_up_on` text;--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`);
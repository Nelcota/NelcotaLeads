CREATE TABLE `notification_reads` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`read_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`user_id`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `emails` ADD `read_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `notification_prefs` text;--> statement-breakpoint
-- Replies received before the notification center existed count as read, so turning it on
-- does not flood the bell with old conversations.
UPDATE `emails` SET `read_at` = coalesce(`sent_at`, `created_at`) WHERE `direction` = 'in' AND `read_at` IS NULL;

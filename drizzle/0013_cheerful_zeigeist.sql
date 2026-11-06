ALTER TABLE `emails` ADD `automatic` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `emails` ADD `conversation_reply` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `dispatch_cancelled_on` text;--> statement-breakpoint
-- Replies stored before the flag existed: the obvious machine senders (bounces, no-reply) only.
UPDATE `emails` SET `automatic` = 1 WHERE `direction` = 'in' AND (lower(`from_address`) LIKE 'mailer-daemon@%' OR lower(`from_address`) LIKE 'postmaster@%' OR lower(`from_address`) LIKE 'noreply@%' OR lower(`from_address`) LIKE 'no-reply@%');

-- Deals closed before closed_at existed: dated by their latest move to "closed" in the history,
-- else by the lead's last e-mail, else by when it was found. The goal and metrics count them.
UPDATE `leads` SET `closed_at` = coalesce(
	(SELECT max(e.`created_at`) FROM `lead_events` e WHERE e.`lead_id` = `leads`.`id` AND e.`kind` = 'status' AND e.`to_value` = 'closed'),
	`last_email_at`,
	`created_at`
) WHERE `status` = 'closed' AND `closed_at` IS NULL;--> statement-breakpoint
-- Lost deals (a person's reason) without lost_at: same rule, from the lost or discard event.
-- AI-triage discards (no loss_reason) are not deals and stay as they are.
UPDATE `leads` SET `lost_at` = coalesce(
	(SELECT max(e.`created_at`) FROM `lead_events` e WHERE e.`lead_id` = `leads`.`id` AND (e.`kind` = 'lost' OR (e.`kind` = 'status' AND e.`to_value` = 'discarded'))),
	`discarded_at`,
	`last_email_at`,
	`created_at`
) WHERE `status` = 'discarded' AND `loss_reason` IS NOT NULL AND `lost_at` IS NULL;

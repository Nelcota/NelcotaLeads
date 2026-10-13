CREATE TABLE `job_runs` (
	`job` text PRIMARY KEY NOT NULL,
	`last_run_at` integer NOT NULL,
	`last_ok_at` integer,
	`last_error_at` integer,
	`last_error` text,
	`consecutive_failures` integer DEFAULT 0 NOT NULL
);

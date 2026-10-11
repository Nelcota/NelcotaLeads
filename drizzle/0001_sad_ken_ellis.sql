CREATE TABLE `api_usage` (
	`day` text NOT NULL,
	`provider` text NOT NULL,
	`requests` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `provider`)
);

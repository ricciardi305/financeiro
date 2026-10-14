CREATE TABLE `raw_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`package_name` text NOT NULL,
	`title` text,
	`text` text,
	`big_text` text,
	`posted_at` text NOT NULL,
	`sbn_key` text NOT NULL,
	`parsed` integer DEFAULT false NOT NULL,
	`parse_error` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `raw_notifications_key_posted_uq` ON `raw_notifications` (`sbn_key`,`posted_at`);
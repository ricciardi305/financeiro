CREATE TABLE `merchant_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern` text NOT NULL,
	`category_id` text NOT NULL,
	`necessity` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merchant_rules_pattern_uq` ON `merchant_rules` (`pattern`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `card_last4` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `refund_of_id` text;
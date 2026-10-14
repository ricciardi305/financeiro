CREATE TABLE `occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`recurrence_id` text NOT NULL,
	`month` text NOT NULL,
	`due_date` text NOT NULL,
	`expected_amount_cents` integer NOT NULL,
	`status` text DEFAULT 'planned' NOT NULL,
	`transaction_id` text,
	FOREIGN KEY (`recurrence_id`) REFERENCES `recurrences`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `occurrences_recurrence_month_uq` ON `occurrences` (`recurrence_id`,`month`);--> statement-breakpoint
CREATE TABLE `recurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`kind` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`necessity` text,
	`amount_cents` integer NOT NULL,
	`is_variable_amount` integer DEFAULT false NOT NULL,
	`day_of_month` integer NOT NULL,
	`start_month` text NOT NULL,
	`end_month` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);

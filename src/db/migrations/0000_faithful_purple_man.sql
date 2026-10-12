CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`institution` text NOT NULL,
	`type` text NOT NULL,
	`initial_balance_cents` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`pluggy_account_id` text,
	`closing_day` integer,
	`due_day` integer,
	`limit_cents` integer,
	`payment_account_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`payment_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`parent_id` text,
	`default_necessity` text,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`card_account_id` text NOT NULL,
	`reference_month` text NOT NULL,
	`closing_date` text NOT NULL,
	`due_date` text NOT NULL,
	FOREIGN KEY (`card_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_card_month_uq` ON `invoices` (`card_account_id`,`reference_month`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`merchant_raw` text,
	`category_id` text,
	`necessity` text,
	`occurred_at` text NOT NULL,
	`occurred_on` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`invoice_id` text,
	`paid_invoice_id` text,
	`installment_group_id` text,
	`installment_number` integer,
	`installment_total` integer,
	`transfer_group_id` text,
	`occurrence_id` text,
	`pluggy_transaction_id` text,
	`raw_notification_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`paid_invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transactions_sign_ck" CHECK(("transactions"."kind" = 'income' AND "transactions"."amount_cents" > 0)
        OR ("transactions"."kind" = 'expense' AND "transactions"."amount_cents" < 0)
        OR "transactions"."kind" IN ('transfer', 'adjustment'))
);
--> statement-breakpoint
CREATE INDEX `transactions_account_date_ix` ON `transactions` (`account_id`,`occurred_on`);--> statement-breakpoint
CREATE INDEX `transactions_invoice_ix` ON `transactions` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `transactions_transfer_ix` ON `transactions` (`transfer_group_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_pluggy_uq` ON `transactions` (`pluggy_transaction_id`) WHERE "transactions"."pluggy_transaction_id" IS NOT NULL AND "transactions"."deleted_at" IS NULL;
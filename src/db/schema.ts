import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { newId } from "./id";

const id = () => text("id").primaryKey().$defaultFn(newId);
const createdAt = () =>
  text("created_at").notNull().$defaultFn(() => new Date().toISOString());

export const accounts = sqliteTable("accounts", {
  id: id(),
  name: text("name").notNull(),
  institution: text("institution", { enum: ["nubank", "inter", "mercadopago", "other"] }).notNull(),
  institutionName: text("institution_name"), // typed name when institution is "other"
  type: text("type", { enum: ["checking", "credit_card", "investment", "cash"] }).notNull(),
  initialBalanceCents: integer("initial_balance_cents").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  pluggyAccountId: text("pluggy_account_id"),
  // credit_card only
  closingDay: integer("closing_day"),
  dueDay: integer("due_day"),
  limitCents: integer("limit_cents"),
  paymentAccountId: text("payment_account_id").references((): AnySQLiteColumn => accounts.id),
  createdAt: createdAt(),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(), // stable slug, so the seed is idempotent
  name: text("name").notNull(),
  kind: text("kind", { enum: ["income", "expense"] }).notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  parentId: text("parent_id").references((): AnySQLiteColumn => categories.id),
  defaultNecessity: text("default_necessity", { enum: ["essential", "optional"] }),
});

// Status is derived in src/domain from dates and payments, never stored.
export const invoices = sqliteTable(
  "invoices",
  {
    id: id(),
    cardAccountId: text("card_account_id").notNull().references(() => accounts.id),
    referenceMonth: text("reference_month").notNull(), // YYYY-MM
    closingDate: text("closing_date").notNull(), // YYYY-MM-DD
    dueDate: text("due_date").notNull(), // YYYY-MM-DD
  },
  (t) => [uniqueIndex("invoices_card_month_uq").on(t.cardAccountId, t.referenceMonth)],
);

export const recurrences = sqliteTable("recurrences", {
  id: id(),
  description: text("description").notNull(),
  kind: text("kind", { enum: ["income", "expense"] }).notNull(),
  accountId: text("account_id").notNull().references(() => accounts.id),
  categoryId: text("category_id").references(() => categories.id),
  necessity: text("necessity", { enum: ["essential", "optional"] }),
  amountCents: integer("amount_cents").notNull(), // expected, positive magnitude
  isVariableAmount: integer("is_variable_amount", { mode: "boolean" }).notNull().default(false),
  dayOfMonth: integer("day_of_month").notNull(),
  startMonth: text("start_month").notNull(), // YYYY-MM
  endMonth: text("end_month"), // YYYY-MM, inclusive
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

// One row per recurrence per month; status "late" is derived from dueDate, never stored.
export const occurrences = sqliteTable(
  "occurrences",
  {
    id: id(),
    recurrenceId: text("recurrence_id").notNull().references(() => recurrences.id),
    month: text("month").notNull(), // YYYY-MM
    dueDate: text("due_date").notNull(), // YYYY-MM-DD
    expectedAmountCents: integer("expected_amount_cents").notNull(),
    status: text("status", { enum: ["planned", "paid", "skipped"] }).notNull().default("planned"),
    transactionId: text("transaction_id").references(() => transactions.id),
  },
  (t) => [uniqueIndex("occurrences_recurrence_month_uq").on(t.recurrenceId, t.month)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: id(),
    accountId: text("account_id").notNull().references(() => accounts.id),
    amountCents: integer("amount_cents").notNull(), // signed: < 0 leaves the account
    kind: text("kind", { enum: ["income", "expense", "transfer", "adjustment"] }).notNull(),
    description: text("description").notNull(),
    merchantRaw: text("merchant_raw"),
    categoryId: text("category_id").references(() => categories.id),
    necessity: text("necessity", { enum: ["essential", "optional"] }),
    occurredAt: text("occurred_at").notNull(), // ISO instant
    occurredOn: text("occurred_on").notNull(), // YYYY-MM-DD in America/Sao_Paulo; all day/month rules use this
    status: text("status", { enum: ["pending", "confirmed"] }).notNull().default("confirmed"),
    source: text("source", { enum: ["manual", "notification", "pluggy", "recurrence"] })
      .notNull()
      .default("manual"),
    invoiceId: text("invoice_id").references(() => invoices.id), // charges, refunds, fees
    paidInvoiceId: text("paid_invoice_id").references(() => invoices.id), // card leg of an invoice payment
    installmentGroupId: text("installment_group_id"),
    installmentNumber: integer("installment_number"),
    installmentTotal: integer("installment_total"),
    transferGroupId: text("transfer_group_id"),
    occurrenceId: text("occurrence_id"), // FK added with the occurrences table
    pluggyTransactionId: text("pluggy_transaction_id"),
    rawNotificationId: text("raw_notification_id"),
    notes: text("notes"),
    createdAt: createdAt(),
    deletedAt: text("deleted_at"),
  },
  (t) => [
    check(
      "transactions_sign_ck",
      sql`(${t.kind} = 'income' AND ${t.amountCents} > 0)
        OR (${t.kind} = 'expense' AND ${t.amountCents} < 0)
        OR ${t.kind} IN ('transfer', 'adjustment')`,
    ),
    index("transactions_account_date_ix").on(t.accountId, t.occurredOn),
    index("transactions_invoice_ix").on(t.invoiceId),
    index("transactions_transfer_ix").on(t.transferGroupId),
    uniqueIndex("transactions_pluggy_uq")
      .on(t.pluggyTransactionId)
      .where(sql`${t.pluggyTransactionId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  ],
);

/** Market value of an investment account on a day, typed by the user. One per account and date. */
export const investmentSnapshots = sqliteTable(
  "investment_snapshots",
  {
    id: id(),
    accountId: text("account_id").notNull().references(() => accounts.id),
    date: text("date").notNull(), // YYYY-MM-DD
    balanceCents: integer("balance_cents").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("investment_snapshots_account_date_uq").on(t.accountId, t.date)],
);

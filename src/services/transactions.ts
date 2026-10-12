import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { newId } from "@/db/id";
import { accounts, categories, transactions } from "@/db/schema";
import { accountBalance, type Balance } from "@/domain/balance";
import { buildEntry, buildTransfer, type EntryInput, type TransferInput } from "@/domain/entries";

function requireAccount(id: string) {
  const a = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!a) throw new Error(`account not found: ${id}`);
  if (a.archived) throw new Error(`account is archived: ${a.name}`);
  return a;
}

export function createEntry(input: EntryInput): string {
  const account = requireAccount(input.accountId);
  if (account.type === "credit_card" && !input.invoiceId) {
    throw new Error("card purchases need an invoice (phase 2)");
  }
  if (input.categoryId) {
    const c = db.select().from(categories).where(eq(categories.id, input.categoryId)).get();
    if (!c) throw new Error(`category not found: ${input.categoryId}`);
    if (c.kind !== input.kind) throw new Error(`category "${c.name}" is not an ${input.kind} category`);
  }
  const id = newId();
  db.insert(transactions).values({ ...buildEntry(input), id }).run();
  return id;
}

/** Returns the transferGroupId. Both legs go in one statement, so it is atomic. */
export function createTransfer(input: Omit<TransferInput, "transferGroupId">): string {
  requireAccount(input.fromAccountId);
  requireAccount(input.toAccountId);
  const transferGroupId = newId();
  db.insert(transactions).values(buildTransfer({ ...input, transferGroupId })).run();
  return transferGroupId;
}

/** Soft delete; a transfer leg takes its sibling with it. */
export function deleteTransaction(id: string): void {
  const t = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!t) throw new Error(`transaction not found: ${id}`);
  const scope = t.transferGroupId
    ? eq(transactions.transferGroupId, t.transferGroupId)
    : eq(transactions.id, id);
  db.update(transactions)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(scope, isNull(transactions.deletedAt)))
    .run();
}

export function getAccountBalance(accountId: string): Balance {
  const a = requireAccount(accountId);
  const rows = db
    .select({ amountCents: transactions.amountCents, status: transactions.status })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), isNull(transactions.deletedAt)))
    .all();
  return accountBalance(a.initialBalanceCents, rows);
}

import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { newId } from "@/db/id";
import { accounts, categories, occurrences, transactions } from "@/db/schema";
import { accountBalance, type Balance } from "@/domain/balance";
import { monthRange } from "@/domain/dates";
import { UserError } from "@/domain/errors";
import {
  buildEntry,
  buildEntryUpdate,
  buildTransfer,
  buildTransferUpdate,
  saoPauloDate,
  type EntryChanges,
  type EntryInput,
  type TransferChanges,
  type TransferInput,
} from "@/domain/entries";

function requireAccount(id: string) {
  const a = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!a) throw new Error(`account not found: ${id}`);
  if (a.archived) throw new Error(`account is archived: ${a.name}`);
  return a;
}

export function requireCategory(categoryId: string | null | undefined, kind: "income" | "expense"): void {
  if (!categoryId) return;
  const c = db.select().from(categories).where(eq(categories.id, categoryId)).get();
  if (!c) throw new Error(`category not found: ${categoryId}`);
  if (c.kind !== kind) throw new UserError(`A categoria "${c.name}" não é de ${kind === "income" ? "receita" : "despesa"}.`);
}

export function createEntry(input: EntryInput): string {
  const account = requireAccount(input.accountId);
  if (account.type === "credit_card" && !input.invoiceId) {
    throw new UserError("Compras no cartão são lançadas pela tela de compra no cartão.");
  }
  requireCategory(input.categoryId, input.kind);
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
  // A recurring bill whose payment was deleted goes back to being unpaid.
  db.update(occurrences)
    .set({ status: "planned", transactionId: null })
    .where(eq(occurrences.transactionId, t.id))
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

export type TransactionRow = {
  id: string;
  accountName: string;
  amountCents: number;
  kind: "income" | "expense" | "transfer" | "adjustment";
  description: string;
  categoryName: string | null;
  occurredOn: string;
  status: "pending" | "confirmed";
  isTransfer: boolean;
};

/** Active transactions of a month (YYYY-MM), newest first, optionally narrowed by account/category. */
export function listTransactions(f: { month: string; accountId?: string; categoryId?: string }): TransactionRow[] {
  const { from, to } = monthRange(f.month);
  const conds = [
    isNull(transactions.deletedAt),
    gte(transactions.occurredOn, from),
    lt(transactions.occurredOn, to),
  ];
  if (f.accountId) conds.push(eq(transactions.accountId, f.accountId));
  if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));
  return db
    .select({
      id: transactions.id,
      accountName: accounts.name,
      amountCents: transactions.amountCents,
      kind: transactions.kind,
      description: transactions.description,
      categoryName: categories.name,
      occurredOn: transactions.occurredOn,
      status: transactions.status,
      transferGroupId: transactions.transferGroupId,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(...conds))
    .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
    .all()
    .map(({ transferGroupId, ...r }) => ({ ...r, isTransfer: transferGroupId !== null }));
}

export type TransactionForEdit = {
  id: string;
  kind: "income" | "expense" | "transfer";
  accountId: string; // for a transfer: the origin
  toAccountId?: string; // transfer destination
  amountCents: number; // magnitude, always positive
  description: string;
  occurredAt: string;
  occurredOn: string;
  categoryId: string | null;
  necessity: "essential" | "optional" | null;
  /** Set for credit-card purchases; their account and date are fixed. */
  invoiceId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
};

function activeLegs(t: typeof transactions.$inferSelect) {
  return t.transferGroupId
    ? db
        .select()
        .from(transactions)
        .where(and(eq(transactions.transferGroupId, t.transferGroupId), isNull(transactions.deletedAt)))
        .all()
    : [t];
}

export function getTransactionForEdit(id: string): TransactionForEdit {
  const t = db.select().from(transactions).where(and(eq(transactions.id, id), isNull(transactions.deletedAt))).get();
  if (!t) throw new UserError("Lançamento não encontrado.");
  if (t.kind === "adjustment") throw new UserError("Ajustes de saldo não podem ser editados.");
  if (t.kind === "transfer") {
    const [out, into] = [activeLegs(t).find((l) => l.amountCents < 0), activeLegs(t).find((l) => l.amountCents > 0)];
    if (!out || !into) throw new Error(`broken transfer: ${t.transferGroupId}`);
    return {
      id, kind: "transfer", accountId: out.accountId, toAccountId: into.accountId,
      amountCents: into.amountCents, description: t.description, occurredAt: t.occurredAt,
      occurredOn: t.occurredOn, categoryId: null, necessity: null,
      invoiceId: null, installmentNumber: null, installmentTotal: null,
    };
  }
  return {
    id, kind: t.kind, accountId: t.accountId, amountCents: Math.abs(t.amountCents), description: t.description,
    occurredAt: t.occurredAt, occurredOn: t.occurredOn, categoryId: t.categoryId, necessity: t.necessity,
    invoiceId: t.invoiceId, installmentNumber: t.installmentNumber, installmentTotal: t.installmentTotal,
  };
}

export function updateEntry(id: string, changes: EntryChanges): void {
  const t = db.select().from(transactions).where(and(eq(transactions.id, id), isNull(transactions.deletedAt))).get();
  if (!t) throw new UserError("Lançamento não encontrado.");
  if (t.kind !== "income" && t.kind !== "expense") throw new UserError("Este tipo de lançamento não pode ser editado aqui.");
  if (t.installmentGroupId) {
    throw new UserError("Compra parcelada é editada pela parcela (updateInstallments).");
  }
  if (t.invoiceId && saoPauloDate(changes.occurredAt) !== t.occurredOn) {
    throw new UserError("Para mudar a data de uma compra no cartão, exclua e lance de novo.");
  }
  if (changes.accountId !== t.accountId) {
    const target = requireAccount(changes.accountId);
    if (target.type === "credit_card") throw new UserError("Compras no cartão ficam na fatura do cartão e não mudam de conta.");
  }
  requireCategory(changes.categoryId, t.kind);
  db.update(transactions).set(buildEntryUpdate(t.kind, changes)).where(eq(transactions.id, id)).run();
}

export type InstallmentScope = "this" | "following";

/** `this` alone, or this one and every later installment of the same purchase. */
function installmentScope(id: string, scope: InstallmentScope) {
  const t = db.select().from(transactions).where(and(eq(transactions.id, id), isNull(transactions.deletedAt))).get();
  if (!t || !t.installmentGroupId || t.installmentNumber === null) throw new UserError("Parcela não encontrada.");
  return {
    t,
    where: and(
      eq(transactions.installmentGroupId, t.installmentGroupId),
      isNull(transactions.deletedAt),
      scope === "this" ? eq(transactions.id, id) : gte(transactions.installmentNumber, t.installmentNumber),
    ),
  };
}

/** Changes the per-installment amount, description, category and necessity. The date (and so the invoice) stays. */
export function updateInstallments(
  id: string,
  scope: InstallmentScope,
  c: { amountCents: number; description: string; categoryId?: string | null; necessity?: "essential" | "optional" | null },
): void {
  const { t, where } = installmentScope(id, scope);
  requireCategory(c.categoryId, "expense");
  const u = buildEntryUpdate("expense", { ...c, accountId: t.accountId, occurredAt: t.occurredAt });
  db.update(transactions)
    .set({ amountCents: u.amountCents, description: u.description, categoryId: u.categoryId, necessity: u.necessity })
    .where(where)
    .run();
}

export function deleteInstallments(id: string, scope: InstallmentScope): void {
  const { where } = installmentScope(id, scope);
  db.update(transactions).set({ deletedAt: new Date().toISOString() }).where(where).run();
}

/** Edits amount, description and date of both legs at once. */
export function updateTransfer(id: string, changes: TransferChanges): void {
  const t = db.select().from(transactions).where(and(eq(transactions.id, id), isNull(transactions.deletedAt))).get();
  if (!t || t.kind !== "transfer") throw new UserError("Transferência não encontrada.");
  const legs = activeLegs(t);
  const out = legs.find((l) => l.amountCents < 0);
  const into = legs.find((l) => l.amountCents > 0);
  if (!out || !into) throw new Error(`broken transfer: ${t.transferGroupId}`);
  const u = buildTransferUpdate(changes);
  db.transaction((tx) => {
    tx.update(transactions).set(u.out).where(eq(transactions.id, out.id)).run();
    tx.update(transactions).set(u.into).where(eq(transactions.id, into.id)).run();
  });
}

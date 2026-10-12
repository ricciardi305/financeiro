import { and, eq, isNull, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { newId } from "@/db/id";
import { accounts, transactions } from "@/db/schema";
import { type AccountInput, validateAccount } from "@/domain/accounts";
import { accountBalance, type Balance } from "@/domain/balance";
import { UserError } from "@/domain/errors";

export type Account = typeof accounts.$inferSelect;

/** Fields that can change after creation. `type` and `initialBalanceCents` are fixed. */
export type AccountPatch = Partial<
  Pick<AccountInput, "name" | "institution" | "pluggyAccountId" | "closingDay" | "dueDay" | "limitCents" | "paymentAccountId">
>;

function requirePaymentAccount(id: string | undefined): void {
  if (!id) return;
  const p = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!p || p.type !== "checking" || p.archived) {
    throw new UserError("A conta que paga a fatura precisa ser uma conta corrente ativa.");
  }
}

export function getAccount(id: string): Account {
  const a = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!a) throw new Error(`account not found: ${id}`);
  return a;
}

export function createAccount(input: AccountInput): string {
  const v = validateAccount(input);
  requirePaymentAccount(v.paymentAccountId);
  const id = newId();
  db.insert(accounts).values({ ...v, id }).run();
  return id;
}

export function updateAccount(id: string, patch: AccountPatch): void {
  const cur = getAccount(id);
  const merged = validateAccount({
    name: cur.name,
    institution: cur.institution,
    type: cur.type,
    initialBalanceCents: cur.initialBalanceCents,
    pluggyAccountId: cur.pluggyAccountId ?? undefined,
    closingDay: cur.closingDay ?? undefined,
    dueDay: cur.dueDay ?? undefined,
    limitCents: cur.limitCents ?? undefined,
    paymentAccountId: cur.paymentAccountId ?? undefined,
    ...patch,
  });
  if (patch.paymentAccountId) requirePaymentAccount(patch.paymentAccountId);
  db.update(accounts)
    .set({
      name: merged.name,
      institution: merged.institution,
      pluggyAccountId: merged.pluggyAccountId ?? null,
      closingDay: merged.closingDay ?? null,
      dueDay: merged.dueDay ?? null,
      limitCents: merged.limitCents ?? null,
      paymentAccountId: merged.paymentAccountId ?? null,
    })
    .where(eq(accounts.id, id))
    .run();
}

/** Accounts are never deleted (transactions point at them); archiving hides them. */
export function setArchived(id: string, archived: boolean): void {
  getAccount(id);
  if (archived) {
    const dependents = db
      .select({ name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.paymentAccountId, id), eq(accounts.archived, false)))
      .all();
    if (dependents.length) {
      throw new UserError(`Não dá para arquivar: esta conta paga a fatura de ${dependents.map((d) => d.name).join(", ")}.`);
    }
  }
  db.update(accounts).set({ archived }).where(eq(accounts.id, id)).run();
}

export type AccountWithBalance = Account & { balance: Balance };

export function listAccounts(opts: { includeArchived?: boolean } = {}): AccountWithBalance[] {
  const list = db.select().from(accounts).orderBy(accounts.name).all();
  const sums = db
    .select({ accountId: transactions.accountId, status: transactions.status, total: sum(transactions.amountCents) })
    .from(transactions)
    .where(isNull(transactions.deletedAt))
    .groupBy(transactions.accountId, transactions.status)
    .all();
  return list
    .filter((a) => opts.includeArchived || !a.archived)
    .map((a) => ({
      ...a,
      balance: accountBalance(
        a.initialBalanceCents,
        sums.filter((s) => s.accountId === a.id).map((s) => ({ amountCents: Number(s.total), status: s.status })),
      ),
    }));
}

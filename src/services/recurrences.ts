import { and, asc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { newId } from "@/db/id";
import { accounts, occurrences, recurrences, transactions } from "@/db/schema";
import { UserError } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import {
  appliesToMonth,
  occurrenceDueDate,
  occurrenceMonths,
  occurrenceState,
  validateRecurrence,
  type OccurrenceState,
  type RecurrenceInput,
} from "@/domain/recurrences";
import { createCardPurchase } from "./invoices";
import { createEntry, deleteTransaction, requireCategory } from "./transactions";

const today = () => saoPauloDate(new Date().toISOString());

export type Recurrence = typeof recurrences.$inferSelect;

function checkAccount(accountId: string, kind: "income" | "expense"): void {
  const a = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!a || a.archived) throw new UserError("Escolha uma conta ativa.");
  if (kind === "income" && a.type === "credit_card") {
    throw new UserError("Receita não pode cair num cartão de crédito.");
  }
}

/** Creates the missing occurrences (start month through next month) of every active recurrence. Idempotent. */
export function generateOccurrences(): void {
  const now = today();
  const rows = db.select().from(recurrences).where(eq(recurrences.active, true)).all();
  const values = rows.flatMap((r) =>
    occurrenceMonths(r, now).map((month) => ({
      id: newId(),
      recurrenceId: r.id,
      month,
      dueDate: occurrenceDueDate(month, r.dayOfMonth),
      expectedAmountCents: r.amountCents,
    })),
  );
  if (values.length) db.insert(occurrences).values(values).onConflictDoNothing().run();
}

/** Brings the still-unpaid occurrences from this month on in line with the recurrence's current terms. */
function resyncPlanned(r: Recurrence): void {
  const thisMonth = today().slice(0, 7);
  const planned = and(
    eq(occurrences.recurrenceId, r.id),
    eq(occurrences.status, "planned"),
    gte(occurrences.month, thisMonth),
  );
  // Out of range (ended, deactivated or moved start): drop them.
  if (!r.active) {
    db.delete(occurrences).where(planned).run();
  } else {
    if (r.endMonth) db.delete(occurrences).where(and(planned, gt(occurrences.month, r.endMonth))).run();
    db.delete(occurrences).where(and(planned, lt(occurrences.month, r.startMonth))).run();
  }
  for (const o of db.select().from(occurrences).where(planned).all()) {
    db.update(occurrences)
      .set({ expectedAmountCents: r.amountCents, dueDate: occurrenceDueDate(o.month, r.dayOfMonth) })
      .where(eq(occurrences.id, o.id))
      .run();
  }
}

export function createRecurrence(input: RecurrenceInput): string {
  const v = validateRecurrence(input);
  checkAccount(v.accountId, v.kind);
  requireCategory(v.categoryId, v.kind);
  const id = newId();
  db.insert(recurrences).values({ ...v, id, active: true }).run();
  generateOccurrences();
  return id;
}

export function getRecurrence(id: string): Recurrence {
  const r = db.select().from(recurrences).where(eq(recurrences.id, id)).get();
  if (!r) throw new UserError("Conta fixa não encontrada.");
  return r;
}

export function updateRecurrence(id: string, input: RecurrenceInput): void {
  const current = getRecurrence(id);
  const v = validateRecurrence(input);
  if (v.kind !== current.kind) throw new UserError("O tipo (receita ou despesa) não muda; crie outra conta fixa.");
  checkAccount(v.accountId, v.kind);
  requireCategory(v.categoryId, v.kind);
  db.update(recurrences)
    .set({
      description: v.description,
      accountId: v.accountId,
      categoryId: v.categoryId ?? null,
      necessity: v.necessity ?? null,
      amountCents: v.amountCents,
      isVariableAmount: v.isVariableAmount,
      dayOfMonth: v.dayOfMonth,
      startMonth: v.startMonth,
      endMonth: v.endMonth ?? null,
    })
    .where(eq(recurrences.id, id))
    .run();
  resyncPlanned(getRecurrence(id));
  generateOccurrences();
}

/** Deactivating stops new occurrences and removes the unpaid ones from this month on; paid history stays. */
export function setRecurrenceActive(id: string, active: boolean): void {
  getRecurrence(id);
  db.update(recurrences).set({ active }).where(eq(recurrences.id, id)).run();
  resyncPlanned(getRecurrence(id));
  generateOccurrences();
}

export function listRecurrences(): (Recurrence & { accountName: string })[] {
  return db
    .select({ r: recurrences, accountName: accounts.name })
    .from(recurrences)
    .innerJoin(accounts, eq(accounts.id, recurrences.accountId))
    .orderBy(asc(recurrences.description))
    .all()
    .map(({ r, accountName }) => ({ ...r, accountName }));
}

export type OccurrenceRow = {
  id: string;
  recurrenceId: string;
  description: string;
  kind: "income" | "expense";
  necessity: "essential" | "optional" | null;
  accountName: string;
  month: string;
  dueDate: string;
  expectedCents: number;
  isVariable: boolean;
  status: "planned" | "paid" | "skipped";
  state: OccurrenceState;
  transactionId: string | null;
  /** Real amount of the linked payment, if paid. */
  paidCents: number | null;
  /** A projection for a month that has no stored occurrence yet; call ensureOccurrence before opening it. */
  virtual: boolean;
};

function occurrenceQuery() {
  return db
    .select({
      id: occurrences.id,
      recurrenceId: occurrences.recurrenceId,
      description: recurrences.description,
      kind: recurrences.kind,
      necessity: recurrences.necessity,
      accountName: accounts.name,
      month: occurrences.month,
      dueDate: occurrences.dueDate,
      expectedCents: occurrences.expectedAmountCents,
      isVariable: recurrences.isVariableAmount,
      status: occurrences.status,
      transactionId: occurrences.transactionId,
      paidAmount: transactions.amountCents,
    })
    .from(occurrences)
    .innerJoin(recurrences, eq(recurrences.id, occurrences.recurrenceId))
    .innerJoin(accounts, eq(accounts.id, recurrences.accountId))
    .leftJoin(transactions, eq(transactions.id, occurrences.transactionId));
}

function toRow(r: ReturnType<typeof occurrenceQuery> extends { all(): (infer T)[] } ? T : never): OccurrenceRow {
  const { paidAmount, ...rest } = r;
  return {
    ...rest,
    state: occurrenceState(r.status, r.dueDate, today()),
    paidCents: paidAmount === null ? null : Math.abs(paidAmount),
    virtual: false,
  };
}

/**
 * Stored occurrences of the month plus projections: active recurrences in force that month but
 * without a stored occurrence (months beyond the generated window) show up as planned.
 */
export function listMonthOccurrences(month: string): OccurrenceRow[] {
  const stored = occurrenceQuery()
    .where(eq(occurrences.month, month))
    .all()
    .map(toRow);
  const have = new Set(stored.map((o) => o.recurrenceId));
  const now = today();
  const projected: OccurrenceRow[] = listRecurrences()
    .filter((r) => !have.has(r.id) && appliesToMonth(r, month))
    .map((r) => {
      const dueDate = occurrenceDueDate(month, r.dayOfMonth);
      return {
        id: `virtual:${r.id}:${month}`,
        recurrenceId: r.id,
        description: r.description,
        kind: r.kind,
        necessity: r.necessity,
        accountName: r.accountName,
        month,
        dueDate,
        expectedCents: r.amountCents,
        isVariable: r.isVariableAmount,
        status: "planned" as const,
        state: occurrenceState("planned", dueDate, now),
        transactionId: null,
        paidCents: null,
        virtual: true,
      };
    });
  return [...stored, ...projected].sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description),
  );
}

/** Stores the occurrence of a projected month (so it can be paid ahead of time). Returns its id. */
export function ensureOccurrence(recurrenceId: string, month: string): string {
  const r = getRecurrence(recurrenceId);
  if (!appliesToMonth(r, month)) throw new UserError("Esta conta fixa não vale para esse mês.");
  const existing = db
    .select({ id: occurrences.id })
    .from(occurrences)
    .where(and(eq(occurrences.recurrenceId, recurrenceId), eq(occurrences.month, month)))
    .get();
  if (existing) return existing.id;
  const id = newId();
  db.insert(occurrences)
    .values({
      id,
      recurrenceId,
      month,
      dueDate: occurrenceDueDate(month, r.dayOfMonth),
      expectedAmountCents: r.amountCents,
    })
    .run();
  return id;
}

export function getOccurrence(id: string): OccurrenceRow {
  const row = occurrenceQuery().where(eq(occurrences.id, id)).get();
  if (!row) throw new UserError("Conta do mês não encontrada.");
  return toRow(row);
}

/** Records the real payment (any amount) and links it to the occurrence. Cards put it on the right invoice. */
export function markOccurrencePaid(id: string, p: { amountCents: number; occurredAt: string }): string {
  const occ = getOccurrence(id);
  if (occ.status !== "planned") {
    throw new UserError("Esta conta já foi paga ou pulada. Desfaça antes de registrar de novo.");
  }
  const rec = getRecurrence(occ.recurrenceId);
  const account = db.select().from(accounts).where(eq(accounts.id, rec.accountId)).get()!;
  if (account.archived) {
    throw new UserError(`A conta "${account.name}" está arquivada. Edite a conta fixa e escolha outra.`);
  }

  let transactionId = "";
  db.transaction(() => {
    if (account.type === "credit_card") {
      transactionId = createCardPurchase({
        cardAccountId: account.id,
        totalCents: p.amountCents,
        description: rec.description,
        occurredAt: p.occurredAt,
        categoryId: rec.categoryId ?? undefined,
        necessity: rec.necessity ?? undefined,
        source: "recurrence",
        occurrenceId: id,
      }).ids[0];
    } else {
      transactionId = createEntry({
        accountId: account.id,
        kind: rec.kind,
        amountCents: p.amountCents,
        description: rec.description,
        occurredAt: p.occurredAt,
        categoryId: rec.categoryId ?? undefined,
        necessity: rec.kind === "expense" ? (rec.necessity ?? undefined) : undefined,
        source: "recurrence",
        occurrenceId: id,
      });
    }
    db.update(occurrences).set({ status: "paid", transactionId }).where(eq(occurrences.id, id)).run();
  });
  return transactionId;
}

export function skipOccurrence(id: string): void {
  const occ = getOccurrence(id);
  if (occ.status !== "planned") throw new UserError("Só dá para pular uma conta ainda não paga.");
  db.update(occurrences).set({ status: "skipped" }).where(eq(occurrences.id, id)).run();
}

/** Undoes a payment (the linked transaction is deleted) or a skip; the occurrence is planned again. */
export function reopenOccurrence(id: string): void {
  const occ = getOccurrence(id);
  if (occ.status === "paid" && occ.transactionId) {
    deleteTransaction(occ.transactionId); // also resets the occurrence
    return;
  }
  db.update(occurrences)
    .set({ status: "planned", transactionId: null })
    .where(and(eq(occurrences.id, id), sql`${occurrences.status} <> 'planned'`))
    .run();
}

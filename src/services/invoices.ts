import { and, asc, desc, eq, isNotNull, isNull, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { newId } from "@/db/id";
import { accounts, invoices, transactions } from "@/db/schema";
import { monthLabel, noonInSaoPaulo } from "@/domain/dates";
import { UserError } from "@/domain/errors";
import { buildEntry, saoPauloDate } from "@/domain/entries";
import {
  closingDateFor,
  dueDateFor,
  invoiceMonthFor,
  invoiceStatus,
  isOverdue,
  planInstallments,
  summarizeInvoice,
  type InvoiceStatus,
  type InvoiceSummary,
} from "@/domain/invoices";
import { formatCents } from "@/domain/money";
import { shiftMonth } from "@/domain/dates";
import { createTransfer, requireCategory } from "./transactions";

type Card = typeof accounts.$inferSelect & { closingDay: number; dueDay: number };

const today = () => saoPauloDate(new Date().toISOString());

function requireCard(id: string): Card {
  const a = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!a || a.type !== "credit_card" || a.closingDay === null || a.dueDay === null) {
    throw new UserError("Cartão não encontrado.");
  }
  if (a.archived) throw new UserError(`O cartão "${a.name}" está arquivado.`);
  return a as Card;
}

/** Finds or creates the invoice of a card for the month it closes in. */
export function ensureInvoice(cardAccountId: string, referenceMonth: string): string {
  const existing = db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.cardAccountId, cardAccountId), eq(invoices.referenceMonth, referenceMonth)))
    .get();
  if (existing) return existing.id;
  const card = requireCard(cardAccountId);
  const id = newId();
  db.insert(invoices)
    .values({
      id,
      cardAccountId,
      referenceMonth,
      closingDate: closingDateFor(referenceMonth, card.closingDay),
      dueDate: dueDateFor(referenceMonth, card.closingDay, card.dueDay),
    })
    .run();
  return id;
}

export type CardPurchaseInput = {
  cardAccountId: string;
  /** Total of the purchase, positive cents; split across installments. */
  totalCents: number;
  description: string;
  occurredAt: string;
  installments?: number;
  /** Manual override: move the whole purchase to a later (+1) or earlier (-1) invoice. */
  monthOffset?: number;
  categoryId?: string;
  necessity?: "essential" | "optional";
  /** Set when the purchase is the payment of a recurring bill. */
  source?: "manual" | "recurrence";
  occurrenceId?: string;
};

/** Which invoices a purchase would hit, for previews. */
export function previewCardPurchase(p: {
  cardAccountId: string;
  totalCents: number;
  occurredAt: string;
  installments?: number;
  monthOffset?: number;
}) {
  const card = requireCard(p.cardAccountId);
  return planInstallments({
    occurredOn: saoPauloDate(p.occurredAt),
    closingDay: card.closingDay,
    totalCents: p.totalCents,
    installments: p.installments ?? 1,
    monthOffset: p.monthOffset,
  }).map((i) => ({
    ...i,
    dueDate: dueDateFor(i.referenceMonth, card.closingDay, card.dueDay),
  }));
}

/** Creates one expense per installment, each on its own invoice. Returns the created ids and the group id (null if single). */
export function createCardPurchase(input: CardPurchaseInput): { ids: string[]; groupId: string | null } {
  const card = requireCard(input.cardAccountId);
  requireCategory(input.categoryId, "expense");
  const count = input.installments ?? 1;
  const plan = planInstallments({
    occurredOn: saoPauloDate(input.occurredAt),
    closingDay: card.closingDay,
    totalCents: input.totalCents,
    installments: count,
    monthOffset: input.monthOffset,
  });
  const groupId = count > 1 ? newId() : null;
  const ids: string[] = [];

  db.transaction(() => {
    for (const part of plan) {
      const row = buildEntry({
        accountId: card.id,
        kind: "expense",
        amountCents: part.amountCents,
        description: input.description,
        // The first charge keeps the exact moment typed; later ones sit on the same day of later months.
        occurredAt: part.number === 1 ? input.occurredAt : noonInSaoPaulo(part.occurredOn),
        categoryId: input.categoryId,
        necessity: input.necessity,
        invoiceId: ensureInvoice(card.id, part.referenceMonth),
        source: input.source,
        occurrenceId: input.occurrenceId,
      });
      const id = newId();
      ids.push(id);
      db.insert(transactions)
        .values({
          ...row,
          id,
          installmentGroupId: groupId,
          installmentNumber: groupId ? part.number : null,
          installmentTotal: groupId ? count : null,
        })
        .run();
    }
  });
  return { ids, groupId };
}

/**
 * Refund (credit, stored as an `adjustment` so it is neither income nor expense) or fee/interest (an expense)
 * on the invoice of `referenceMonth`. Both carry the invoiceId, so the invoice total moves.
 */
export function addInvoiceAdjustment(input: {
  cardAccountId: string;
  referenceMonth: string;
  type: "refund" | "fee";
  amountCents: number;
  description: string;
  occurredAt: string;
  categoryId?: string;
}): string {
  const card = requireCard(input.cardAccountId);
  requireCategory(input.categoryId, "expense");
  const base = {
    accountId: card.id,
    amountCents: input.amountCents,
    description: input.description,
    occurredAt: input.occurredAt,
    categoryId: input.categoryId,
    invoiceId: ensureInvoice(card.id, input.referenceMonth),
  };
  const id = newId();
  const row =
    input.type === "fee"
      ? buildEntry({ ...base, kind: "expense" })
      : { ...buildEntry({ ...base, kind: "income" }), kind: "adjustment" as const };
  db.insert(transactions).values({ ...row, id }).run();
  return id;
}

export type InvoiceListItem = {
  id: string;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  summary: InvoiceSummary;
  status: InvoiceStatus;
  overdue: boolean;
};

function sumsByInvoice() {
  const charges = db
    .select({ invoiceId: transactions.invoiceId, total: sum(transactions.amountCents) })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), isNotNull(transactions.invoiceId)))
    .groupBy(transactions.invoiceId)
    .all();
  const payments = db
    .select({ invoiceId: transactions.paidInvoiceId, total: sum(transactions.amountCents) })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), isNotNull(transactions.paidInvoiceId)))
    .groupBy(transactions.paidInvoiceId)
    .all();
  return {
    charge: new Map(charges.map((c) => [c.invoiceId, Number(c.total)])),
    paid: new Map(payments.map((p) => [p.invoiceId, Number(p.total)])),
  };
}

function toItem(
  inv: typeof invoices.$inferSelect,
  sums: ReturnType<typeof sumsByInvoice>,
  now: string,
): InvoiceListItem {
  const summary = summarizeInvoice([sums.charge.get(inv.id) ?? 0], [sums.paid.get(inv.id) ?? 0]);
  const status = invoiceStatus(summary, inv.closingDate, now);
  return {
    id: inv.id,
    referenceMonth: inv.referenceMonth,
    closingDate: inv.closingDate,
    dueDate: inv.dueDate,
    summary,
    status,
    overdue: isOverdue(status, inv.dueDate, now),
  };
}

export type InvoiceLine = {
  id: string;
  occurredOn: string;
  description: string;
  amountCents: number; // signed: purchases < 0
  installmentNumber: number | null;
  installmentTotal: number | null;
};

export type InvoiceDetail = Omit<InvoiceListItem, "id"> & {
  /** null when the month has no invoice yet (nothing was bought on it). */
  id: string | null;
  card: { id: string; name: string; paymentAccountId: string | null };
  lines: InvoiceLine[];
  payments: { id: string; occurredOn: string; amountCents: number }[];
};

function detailFor(card: Card, inv: typeof invoices.$inferSelect | undefined, referenceMonth: string): InvoiceDetail {
  const now = today();
  const closingDate = inv?.closingDate ?? closingDateFor(referenceMonth, card.closingDay);
  const dueDate = inv?.dueDate ?? dueDateFor(referenceMonth, card.closingDay, card.dueDay);
  const base = inv
    ? toItem(inv, sumsByInvoice(), now)
    : (() => {
        const summary = summarizeInvoice([], []);
        const status = invoiceStatus(summary, closingDate, now);
        return { id: "", referenceMonth, closingDate, dueDate, summary, status, overdue: false };
      })();
  const cardInfo = { id: card.id, name: card.name, paymentAccountId: card.paymentAccountId };
  if (!inv) return { ...base, id: null, card: cardInfo, lines: [], payments: [] };

  const lines = db
    .select({
      id: transactions.id,
      occurredOn: transactions.occurredOn,
      description: transactions.description,
      amountCents: transactions.amountCents,
      installmentNumber: transactions.installmentNumber,
      installmentTotal: transactions.installmentTotal,
    })
    .from(transactions)
    .where(and(eq(transactions.invoiceId, inv.id), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.occurredOn), asc(transactions.createdAt))
    .all();
  const payments = db
    .select({ id: transactions.id, occurredOn: transactions.occurredOn, amountCents: transactions.amountCents })
    .from(transactions)
    .where(and(eq(transactions.paidInvoiceId, inv.id), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.occurredOn))
    .all();
  return { ...base, card: cardInfo, lines, payments };
}

/**
 * Unpaid amount of every invoice up to the one open today, per active card. Later invoices (future
 * installments) are not debt yet. Feeds net worth.
 */
export function openInvoiceDebtCents(): number {
  const sums = sumsByInvoice();
  const cards = db.select().from(accounts).where(eq(accounts.type, "credit_card")).all().filter((c) => !c.archived);
  let debt = 0;
  for (const card of cards) {
    const upTo = currentInvoiceMonth(card.id);
    for (const inv of db.select().from(invoices).where(eq(invoices.cardAccountId, card.id)).all()) {
      if (inv.referenceMonth <= upTo) {
        debt += summarizeInvoice([sums.charge.get(inv.id) ?? 0], [sums.paid.get(inv.id) ?? 0]).remainingCents;
      }
    }
  }
  return debt;
}

export type DueInvoice = { id: string; cardName: string; referenceMonth: string; dueDate: string; remainingCents: number };

/** Unpaid invoices that fall due before `beforeDate` (YYYY-MM-DD), overdue ones included. */
export function invoicesDueBefore(beforeDate: string): DueInvoice[] {
  const sums = sumsByInvoice();
  return db
    .select({ inv: invoices, cardName: accounts.name, archived: accounts.archived })
    .from(invoices)
    .innerJoin(accounts, eq(accounts.id, invoices.cardAccountId))
    .all()
    .filter((r) => !r.archived && r.inv.dueDate < beforeDate)
    .map((r) => ({
      id: r.inv.id,
      cardName: r.cardName,
      referenceMonth: r.inv.referenceMonth,
      dueDate: r.inv.dueDate,
      remainingCents: summarizeInvoice([sums.charge.get(r.inv.id) ?? 0], [sums.paid.get(r.inv.id) ?? 0]).remainingCents,
    }))
    .filter((r) => r.remainingCents > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** The month the card's open invoice closes in: where the carousel starts. */
export function currentInvoiceMonth(cardAccountId: string): string {
  return invoiceMonthFor(today(), requireCard(cardAccountId).closingDay);
}

/** One month of a card's carousel. Months without purchases are shown from the calendar, not stored. */
export function getInvoiceByMonth(cardAccountId: string, referenceMonth: string): InvoiceDetail {
  const card = requireCard(cardAccountId);
  const inv = db
    .select()
    .from(invoices)
    .where(and(eq(invoices.cardAccountId, card.id), eq(invoices.referenceMonth, referenceMonth)))
    .get();
  return detailFor(card, inv, referenceMonth);
}

export function getInvoiceDetail(invoiceId: string): InvoiceDetail & { id: string } {
  const inv = db.select().from(invoices).where(eq(invoices.id, invoiceId)).get();
  if (!inv) throw new UserError("Fatura não encontrada.");
  return detailFor(requireCard(inv.cardAccountId), inv, inv.referenceMonth) as InvoiceDetail & { id: string };
}

/** Pays all or part of an invoice from the card's payment account. Returns the transfer group id. */
export function payInvoice(input: { invoiceId: string; amountCents: number; occurredAt: string }): string {
  const detail = getInvoiceDetail(input.invoiceId);
  if (!detail.card.paymentAccountId) throw new UserError("O cartão não tem uma conta pagadora.");
  if (detail.summary.remainingCents <= 0) throw new UserError("Esta fatura não tem valor a pagar.");
  if (input.amountCents > detail.summary.remainingCents) {
    throw new UserError(`O valor é maior que o restante da fatura (${formatCents(detail.summary.remainingCents)}).`);
  }
  return createTransfer({
    fromAccountId: detail.card.paymentAccountId,
    toAccountId: detail.card.id,
    amountCents: input.amountCents,
    description: `Pagamento da fatura de ${monthLabel(detail.referenceMonth)}`,
    occurredAt: input.occurredAt,
    paidInvoiceId: input.invoiceId,
  });
}

import { addMonthsClamped, clampedDate, shiftMonth } from "./dates";
import { UserError } from "./errors";

/** Closing date of the invoice that carries `referenceMonth` (its closing month). Day 31 -> last day. */
export const closingDateFor = (referenceMonth: string, closingDay: number): string =>
  clampedDate(referenceMonth, closingDay);

/** First `dueDay` strictly after the closing date: same month if it is later, else the next month. */
export function dueDateFor(referenceMonth: string, closingDay: number, dueDay: number): string {
  const sameMonth = clampedDate(referenceMonth, dueDay);
  return sameMonth > closingDateFor(referenceMonth, closingDay)
    ? sameMonth
    : clampedDate(shiftMonth(referenceMonth, 1), dueDay);
}

/**
 * Which invoice a purchase lands on, as the month the invoice closes in.
 * A purchase ON the closing day goes to the next invoice (confirmed for Inter; assumed for Nubank).
 */
export function invoiceMonthFor(occurredOn: string, closingDay: number): string {
  const month = occurredOn.slice(0, 7);
  return occurredOn < closingDateFor(month, closingDay) ? month : shiftMonth(month, 1);
}

/** Splits a total into `n` parts; the rounding difference goes to the first one. */
export function splitInstallments(totalCents: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1 || n > 99) throw new UserError("Informe de 1 a 99 parcelas.");
  if (!Number.isSafeInteger(totalCents) || totalCents < n) {
    throw new UserError("O valor é pequeno demais para essa quantidade de parcelas.");
  }
  const base = Math.floor(totalCents / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? totalCents - base * (n - 1) : base));
}

export type PlannedInstallment = {
  number: number;
  amountCents: number; // positive magnitude
  occurredOn: string;
  referenceMonth: string; // invoice closing month
};

/**
 * One planned charge per invoice, starting at the invoice the purchase date falls on.
 * `monthOffset` moves the whole plan to a later/earlier invoice (manual override).
 */
export function planInstallments(p: {
  occurredOn: string;
  closingDay: number;
  totalCents: number;
  installments: number;
  monthOffset?: number;
}): PlannedInstallment[] {
  const first = shiftMonth(invoiceMonthFor(p.occurredOn, p.closingDay), p.monthOffset ?? 0);
  return splitInstallments(p.totalCents, p.installments).map((amountCents, i) => ({
    number: i + 1,
    amountCents,
    occurredOn: addMonthsClamped(p.occurredOn, i),
    referenceMonth: shiftMonth(first, i),
  }));
}

export type InvoiceStatus = "open" | "closed" | "paid" | "partially_paid";

export type InvoiceSummary = { totalCents: number; paidCents: number; remainingCents: number };

/**
 * `chargeAmounts` are the signed amounts of the lines carrying the invoiceId (purchases < 0,
 * refunds > 0); `paymentAmounts` are the positive card legs carrying paidInvoiceId.
 */
export function summarizeInvoice(chargeAmounts: number[], paymentAmounts: number[]): InvoiceSummary {
  const totalCents = -chargeAmounts.reduce((a, b) => a + b, 0);
  const paidCents = paymentAmounts.reduce((a, b) => a + b, 0);
  return { totalCents, paidCents, remainingCents: Math.max(0, totalCents - paidCents) };
}

/** Derived, never stored. `today` and `closingDate` are YYYY-MM-DD. */
export function invoiceStatus(s: InvoiceSummary, closingDate: string, today: string): InvoiceStatus {
  if (today < closingDate) return "open";
  if (s.totalCents <= 0 || s.paidCents >= s.totalCents) return "paid";
  return s.paidCents > 0 ? "partially_paid" : "closed";
}

export const isOverdue = (status: InvoiceStatus, dueDate: string, today: string): boolean =>
  (status === "closed" || status === "partially_paid") && today > dueDate;

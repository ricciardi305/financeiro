import { and, eq, gte, isNull, lt, or, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { monthRange } from "@/domain/dates";
import { saoPauloDate } from "@/domain/entries";
import {
  liquidBalance,
  netWorth,
  projectedEndBalance,
  spendingBreakdown,
  type NetWorth,
  type SpendingBreakdown,
} from "@/domain/overview";
import { totalsForKind } from "@/domain/recurrences";
import { listAccounts } from "./accounts";
import { invoicesDueBefore, openInvoiceDebtCents, type DueInvoice } from "./invoices";
import { listMonthOccurrences } from "./recurrences";

const balances = () => listAccounts().map((a) => ({ type: a.type, balanceCents: a.balance.confirmedCents }));

export function getNetWorth(): NetWorth {
  return netWorth(balances(), openInvoiceDebtCents());
}

export type MonthOverview = {
  month: string;
  incomeCents: number; // received so far
  spending: SpendingBreakdown;
  pendingIncomeCents: number; // fixed income still expected
  pendingExpenseCents: number; // fixed bills still to pay
  dueInvoices: DueInvoice[];
  /** Only for the current month; null for other months. */
  projectedEndCents: number | null;
};

/**
 * Month at a glance. Card purchases count as spending on the purchase date (installments, one per month);
 * paying an invoice is a transfer and counts for nothing, so nothing is counted twice.
 */
export function getMonthOverview(month: string): MonthOverview {
  const { from, to } = monthRange(month);
  const rows = db
    .select({
      kind: transactions.kind,
      amountCents: transactions.amountCents,
      necessity: transactions.necessity,
      categoryName: categories.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        isNull(transactions.deletedAt),
        gte(transactions.occurredOn, from),
        lt(transactions.occurredOn, to),
        // A card refund is an adjustment on an invoice; plain balance adjustments stay out.
        or(eq(transactions.kind, "income"), eq(transactions.kind, "expense"), and(eq(transactions.kind, "adjustment"), isNotNull(transactions.invoiceId))),
      ),
    )
    .all();

  const incomeCents = rows.filter((r) => r.kind === "income").reduce((s, r) => s + r.amountCents, 0);
  const spending = spendingBreakdown(rows.filter((r) => r.kind !== "income"));

  const items = listMonthOccurrences(month).map((o) => ({
    kind: o.kind,
    state: o.state,
    expectedCents: o.expectedCents,
    paidCents: o.paidCents,
  }));
  const pendingIncomeCents = totalsForKind(items, "income").pendingCents;
  const pendingExpenseCents = totalsForKind(items, "expense").pendingCents;
  const dueInvoices = invoicesDueBefore(to);

  const isCurrent = saoPauloDate(new Date().toISOString()).slice(0, 7) === month;
  return {
    month,
    incomeCents,
    spending,
    pendingIncomeCents,
    pendingExpenseCents,
    dueInvoices,
    projectedEndCents: isCurrent
      ? projectedEndBalance({
          liquidCents: liquidBalance(balances()),
          pendingIncomeCents,
          pendingExpenseCents,
          invoicesDueCents: dueInvoices.reduce((s, i) => s + i.remainingCents, 0),
        })
      : null,
  };
}

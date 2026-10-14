export type AccountKind = "checking" | "credit_card" | "investment" | "cash";

export type NetWorth = { assetsCents: number; debtCents: number; netCents: number };

/**
 * Net worth = checking + cash + investments − open invoices. Credit-card accounts are left out of the
 * sum: their debt already enters through the invoices, and adding both would count it twice.
 */
export function netWorth(accounts: { type: AccountKind; balanceCents: number }[], openInvoiceDebtCents: number): NetWorth {
  const assetsCents = accounts.filter((a) => a.type !== "credit_card").reduce((s, a) => s + a.balanceCents, 0);
  return { assetsCents, debtCents: openInvoiceDebtCents, netCents: assetsCents - openInvoiceDebtCents };
}

/** Money available now: checking accounts and wallet (investments are not spendable cash). */
export const liquidBalance = (accounts: { type: AccountKind; balanceCents: number }[]): number =>
  accounts.filter((a) => a.type === "checking" || a.type === "cash").reduce((s, a) => s + a.balanceCents, 0);

/** Signed row of spending: expenses are negative, refunds positive (they cancel part of an expense). */
export type SpendRow = {
  amountCents: number;
  categoryName: string | null;
  necessity: "essential" | "optional" | null;
};

export type SpendingBreakdown = {
  totalCents: number;
  byCategory: { name: string; cents: number }[];
  byNecessity: { essentialCents: number; optionalCents: number; unclassifiedCents: number };
};

export const NO_CATEGORY = "Sem categoria";

/** Spending of a period as positive cents, biggest category first. Refunds net out of their category. */
export function spendingBreakdown(rows: SpendRow[]): SpendingBreakdown {
  const byCategory = new Map<string, number>();
  const byNecessity = { essentialCents: 0, optionalCents: 0, unclassifiedCents: 0 };
  let totalCents = 0;
  for (const r of rows) {
    const cents = -r.amountCents;
    totalCents += cents;
    const name = r.categoryName ?? NO_CATEGORY;
    byCategory.set(name, (byCategory.get(name) ?? 0) + cents);
    if (r.necessity === "essential") byNecessity.essentialCents += cents;
    else if (r.necessity === "optional") byNecessity.optionalCents += cents;
    else byNecessity.unclassifiedCents += cents;
  }
  return {
    totalCents,
    byCategory: [...byCategory]
      .filter(([, cents]) => cents !== 0)
      .map(([name, cents]) => ({ name, cents }))
      .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name)),
    byNecessity,
  };
}

/** End-of-month balance: money now + income still expected − bills still expected − unpaid invoices falling due. */
export const projectedEndBalance = (p: {
  liquidCents: number;
  pendingIncomeCents: number;
  pendingExpenseCents: number;
  invoicesDueCents: number;
}): number => p.liquidCents + p.pendingIncomeCents - p.pendingExpenseCents - p.invoicesDueCents;

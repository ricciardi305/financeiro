export type BalanceTx = {
  amountCents: number;
  status: "pending" | "confirmed";
  deletedAt?: string | null;
};

export type Balance = { confirmedCents: number; pendingCents: number; projectedCents: number };

/** Balance = initial + confirmed; pending is reported apart, soft-deleted rows are ignored. */
export function accountBalance(initialBalanceCents: number, txs: BalanceTx[]): Balance {
  let confirmed = 0;
  let pending = 0;
  for (const t of txs) {
    if (t.deletedAt) continue;
    if (t.status === "confirmed") confirmed += t.amountCents;
    else pending += t.amountCents;
  }
  const confirmedCents = initialBalanceCents + confirmed;
  return { confirmedCents, pendingCents: pending, projectedCents: confirmedCents + pending };
}

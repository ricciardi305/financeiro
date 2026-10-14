import { UserError } from "./errors";

export type Snapshot = { date: string; balanceCents: number };
/** Money moved into (+) or out of (−) the investment account: contributions and redemptions. */
export type Flow = { occurredOn: string; amountCents: number };

/**
 * Current value. With a snapshot, it is the latest typed balance plus the flows after that day (flows on the
 * snapshot day are already inside it). Without one, falls back to the ledger: initial balance + all flows.
 */
export function investmentValue(initialBalanceCents: number, snapshots: Snapshot[], flows: Flow[]): number {
  const last = snapshots.reduce<Snapshot | undefined>((a, s) => (!a || s.date > a.date ? s : a), undefined);
  if (!last) return initialBalanceCents + flows.reduce((s, f) => s + f.amountCents, 0);
  return last.balanceCents + flows.filter((f) => f.occurredOn > last.date).reduce((s, f) => s + f.amountCents, 0);
}

export type SnapshotRow = {
  date: string;
  balanceCents: number;
  /** Net contributions − redemptions since the previous snapshot; null on the first one. */
  flowCents: number | null;
  /** Yield since the previous snapshot = balance − previous balance − net flow; null on the first one. */
  yieldCents: number | null;
};

/** Rows in date order with the yield of each period. Flows on a snapshot's day belong to the period ending there. */
export function snapshotRows(snapshots: Snapshot[], flows: Flow[]): SnapshotRow[] {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((s, i) => {
    const prev = sorted[i - 1];
    if (!prev) return { ...s, flowCents: null, yieldCents: null };
    const flowCents = flows
      .filter((f) => f.occurredOn > prev.date && f.occurredOn <= s.date)
      .reduce((sum, f) => sum + f.amountCents, 0);
    return { ...s, flowCents, yieldCents: s.balanceCents - prev.balanceCents - flowCents };
  });
}

/** Total yield over all periods between snapshots. */
export const totalYield = (rows: SnapshotRow[]): number => rows.reduce((s, r) => s + (r.yieldCents ?? 0), 0);

export function validateSnapshot(s: Snapshot, today: string): Snapshot {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) throw new UserError("Data inválida.");
  if (s.date > today) throw new UserError("A data não pode ser no futuro.");
  if (!Number.isSafeInteger(s.balanceCents) || s.balanceCents < 0) throw new UserError("Informe o saldo atual do investimento.");
  return s;
}

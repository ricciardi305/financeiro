import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { newId } from "@/db/id";
import { accounts, investmentSnapshots, transactions } from "@/db/schema";
import { UserError } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import {
  investmentValue,
  snapshotRows,
  totalYield,
  validateSnapshot,
  type Flow,
  type Snapshot,
  type SnapshotRow,
} from "@/domain/investments";

function requireInvestment(accountId: string) {
  const a = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
  if (!a || a.type !== "investment") throw new UserError("Investimento não encontrado.");
  return a;
}

const flowsOf = (accountId: string): Flow[] =>
  db
    .select({ occurredOn: transactions.occurredOn, amountCents: transactions.amountCents })
    .from(transactions)
    .where(and(eq(transactions.accountId, accountId), isNull(transactions.deletedAt)))
    .all();

const snapshotsOf = (accountId: string): Snapshot[] =>
  db
    .select({ date: investmentSnapshots.date, balanceCents: investmentSnapshots.balanceCents })
    .from(investmentSnapshots)
    .where(eq(investmentSnapshots.accountId, accountId))
    .all();

/** Current value of an investment account (latest snapshot + later flows, or the ledger without snapshots). */
export function investmentValueOf(accountId: string): number {
  const a = requireInvestment(accountId);
  return investmentValue(a.initialBalanceCents, snapshotsOf(accountId), flowsOf(accountId));
}

export type InvestmentDetail = {
  name: string;
  valueCents: number;
  /** Newest first. */
  rows: (SnapshotRow & { id: string })[];
  totalYieldCents: number;
  hasPeriods: boolean;
};

export function getInvestment(accountId: string): InvestmentDetail {
  const a = requireInvestment(accountId);
  const snaps = snapshotsOf(accountId);
  const flows = flowsOf(accountId);
  const ids = new Map(
    db
      .select({ id: investmentSnapshots.id, date: investmentSnapshots.date })
      .from(investmentSnapshots)
      .where(eq(investmentSnapshots.accountId, accountId))
      .all()
      .map((r) => [r.date, r.id]),
  );
  const rows = snapshotRows(snaps, flows);
  return {
    name: a.name,
    valueCents: investmentValue(a.initialBalanceCents, snaps, flows),
    rows: rows.map((r) => ({ ...r, id: ids.get(r.date)! })).reverse(),
    totalYieldCents: totalYield(rows),
    hasPeriods: rows.length > 1,
  };
}

/** Records the balance typed on a day; a second one for the same day replaces the first. */
export function saveSnapshot(accountId: string, s: Snapshot): void {
  requireInvestment(accountId);
  const v = validateSnapshot(s, saoPauloDate(new Date().toISOString()));
  db.insert(investmentSnapshots)
    .values({ id: newId(), accountId, ...v })
    .onConflictDoUpdate({
      target: [investmentSnapshots.accountId, investmentSnapshots.date],
      set: { balanceCents: v.balanceCents },
    })
    .run();
}

export function deleteSnapshot(id: string): void {
  db.delete(investmentSnapshots).where(eq(investmentSnapshots.id, id)).run();
}

import { clampedDate, shiftMonth } from "./dates";
import { UserError } from "./errors";

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export type RecurrenceInput = {
  description: string;
  kind: "income" | "expense";
  accountId: string;
  categoryId?: string;
  necessity?: "essential" | "optional";
  /** Expected amount, positive cents. */
  amountCents: number;
  isVariableAmount: boolean;
  dayOfMonth: number;
  startMonth: string;
  endMonth?: string;
};

/** Returns the normalized input or throws a user-facing error. */
export function validateRecurrence(i: RecurrenceInput): RecurrenceInput {
  const description = i.description.trim();
  if (!description) throw new UserError("Informe uma descrição.");
  if (!Number.isSafeInteger(i.amountCents) || i.amountCents <= 0) {
    throw new UserError("Informe um valor previsto maior que zero.");
  }
  if (!Number.isInteger(i.dayOfMonth) || i.dayOfMonth < 1 || i.dayOfMonth > 31) {
    throw new UserError("Informe o dia do mês (de 1 a 31).");
  }
  if (!i.accountId) throw new UserError("Escolha a conta.");
  if (!MONTH.test(i.startMonth)) throw new UserError("Mês inicial inválido.");
  if (i.endMonth !== undefined) {
    if (!MONTH.test(i.endMonth)) throw new UserError("Mês final inválido.");
    if (i.endMonth < i.startMonth) throw new UserError("O mês final não pode ser antes do inicial.");
  }
  return { ...i, description, necessity: i.kind === "expense" ? i.necessity : undefined };
}

/** Due date of the occurrence in `month`: the recurrence day, clamped to short months (31 -> 30/28). */
export const occurrenceDueDate = (month: string, dayOfMonth: number): string => clampedDate(month, dayOfMonth);

/**
 * Months that should have an occurrence: from the start month through the next month
 * (or the end month, if earlier). Nothing for inactive recurrences.
 * `today` is YYYY-MM-DD; creating the missing ones is idempotent (unique on recurrence + month).
 */
export function occurrenceMonths(
  r: { startMonth: string; endMonth?: string | null; active: boolean },
  today: string,
): string[] {
  if (!r.active) return [];
  const last = shiftMonth(today.slice(0, 7), 1);
  const stop = r.endMonth && r.endMonth < last ? r.endMonth : last;
  const months: string[] = [];
  for (let m = r.startMonth; m <= stop; m = shiftMonth(m, 1)) months.push(m);
  return months;
}

/** Whether a recurrence is in force in `month`: active and between its start and end months. */
export function appliesToMonth(
  r: { startMonth: string; endMonth?: string | null; active: boolean },
  month: string,
): boolean {
  return r.active && month >= r.startMonth && (!r.endMonth || month <= r.endMonth);
}

export type OccurrenceState = "planned" | "late" | "paid" | "skipped";

/** Late is derived: still planned and the due date has passed. */
export function occurrenceState(
  status: "planned" | "paid" | "skipped",
  dueDate: string,
  today: string,
): OccurrenceState {
  return status === "planned" && dueDate < today ? "late" : status;
}

export type MonthItem = {
  kind: "income" | "expense";
  state: OccurrenceState;
  expectedCents: number;
  paidCents: number | null;
};

export type MonthTotals = { expectedCents: number; paidCents: number; pendingCents: number };

/**
 * Totals for one kind. Skipped items count for nothing; paid items count their real amount
 * (which may differ from the expected one); planned and late items are still pending.
 */
export function totalsForKind(items: MonthItem[], kind: "income" | "expense"): MonthTotals {
  let expectedCents = 0;
  let paidCents = 0;
  let pendingCents = 0;
  for (const it of items) {
    if (it.kind !== kind || it.state === "skipped") continue;
    if (it.state === "paid") {
      paidCents += it.paidCents ?? it.expectedCents;
      expectedCents += it.paidCents ?? it.expectedCents;
    } else {
      pendingCents += it.expectedCents;
      expectedCents += it.expectedCents;
    }
  }
  return { expectedCents, paidCents, pendingCents };
}

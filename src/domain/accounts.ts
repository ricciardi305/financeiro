import type { accounts } from "@/db/schema";
import { UserError } from "./errors";

export type AccountType = (typeof accounts.$inferSelect)["type"];
export type Institution = (typeof accounts.$inferSelect)["institution"];

export type AccountInput = {
  name: string;
  institution: Institution;
  type: AccountType;
  /** Set once at creation; never edited afterwards (corrections are `adjustment` entries). */
  initialBalanceCents: number;
  pluggyAccountId?: string;
  // credit_card only
  closingDay?: number;
  dueDay?: number;
  limitCents?: number;
  paymentAccountId?: string;
};

const isDay = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 31;

/** Returns the normalized input or throws. Cross-table checks (payment account) live in the service. */
export function validateAccount(i: AccountInput): AccountInput {
  const name = i.name.trim();
  if (!name) throw new UserError("Informe o nome da conta.");
  if (!Number.isSafeInteger(i.initialBalanceCents)) throw new UserError("Saldo inicial inválido.");

  if (i.type === "credit_card") {
    if (!isDay(i.closingDay)) throw new UserError("Informe o dia de fechamento (de 1 a 31).");
    if (!isDay(i.dueDay)) throw new UserError("Informe o dia de vencimento (de 1 a 31).");
    if (!i.paymentAccountId) throw new UserError("Escolha a conta que paga a fatura.");
    if (i.limitCents !== undefined && (!Number.isSafeInteger(i.limitCents) || i.limitCents < 0)) {
      throw new UserError("O limite não pode ser negativo.");
    }
  } else if (
    i.closingDay !== undefined ||
    i.dueDay !== undefined ||
    i.limitCents !== undefined ||
    i.paymentAccountId !== undefined
  ) {
    throw new Error("card fields only apply to credit_card accounts");
  }
  return { ...i, name };
}

import type { AccountType, Institution } from "@/domain/accounts";

export const TYPE_LABEL: Record<AccountType, string> = {
  checking: "Conta corrente",
  credit_card: "Cartão de crédito",
  investment: "Investimento",
  cash: "Carteira",
};

export const INSTITUTION_LABEL: Record<Institution, string> = {
  nubank: "Nubank",
  inter: "Inter",
  other: "Outra",
};

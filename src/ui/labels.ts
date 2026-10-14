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
  mercadopago: "Mercado Pago",
  other: "Outra",
};

/** The typed name for "other", the standard label otherwise. */
export const institutionLabel = (a: { institution: Institution; institutionName: string | null }): string =>
  a.institution === "other" && a.institutionName ? a.institutionName : INSTITUTION_LABEL[a.institution];

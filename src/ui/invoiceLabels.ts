import { isoDateToBr, monthLabel } from "@/domain/dates";
import type { InvoiceListItem } from "@/services/invoices";
import { colors } from "./theme";

export const STATUS_LABEL = {
  open: "Aberta",
  closed: "Fechada",
  paid: "Paga",
  partially_paid: "Paga em parte",
} as const;

/** "Vencida" wins over the plain status when the due date has passed unpaid. */
export function statusBadge(inv: Pick<InvoiceListItem, "status" | "overdue">): { label: string; color: string } {
  if (inv.overdue) return { label: "Vencida", color: colors.expense };
  if (inv.status === "paid") return { label: STATUS_LABEL.paid, color: colors.income };
  return { label: STATUS_LABEL[inv.status], color: colors.muted };
}

export const invoiceTitle = (referenceMonth: string): string => `Fatura de ${monthLabel(referenceMonth)}`;

export const dueText = (dueDate: string): string => `vence em ${isoDateToBr(dueDate).slice(0, 5)}`;

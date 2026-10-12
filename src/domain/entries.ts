import type { transactions } from "@/db/schema";

export type NewTransaction = typeof transactions.$inferInsert;

const TZ = "America/Sao_Paulo";

/** YYYY-MM-DD of an ISO instant in São Paulo; every day/month rule uses this, never UTC. */
export function saoPauloDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function checkAmount(cents: number): void {
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("amountCents must be a positive integer (cents)");
  }
}

function checkDescription(text: string): string {
  const d = text.trim();
  if (!d) throw new Error("description is required");
  return d;
}

export type EntryInput = {
  accountId: string;
  kind: "income" | "expense";
  /** Magnitude in cents, always positive; the sign comes from `kind`. */
  amountCents: number;
  description: string;
  occurredAt: string;
  categoryId?: string;
  necessity?: "essential" | "optional";
  status?: "pending" | "confirmed";
  source?: NewTransaction["source"];
  merchantRaw?: string;
  notes?: string;
  invoiceId?: string;
};

export function buildEntry(i: EntryInput): NewTransaction {
  checkAmount(i.amountCents);
  return {
    accountId: i.accountId,
    kind: i.kind,
    amountCents: i.kind === "expense" ? -i.amountCents : i.amountCents,
    description: checkDescription(i.description),
    occurredAt: i.occurredAt,
    occurredOn: saoPauloDate(i.occurredAt),
    categoryId: i.categoryId,
    necessity: i.necessity,
    status: i.status,
    source: i.source,
    merchantRaw: i.merchantRaw,
    notes: i.notes,
    invoiceId: i.invoiceId,
  };
}

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  description: string;
  occurredAt: string;
  transferGroupId: string;
  /** Set when the transfer pays a card invoice; goes on the card leg only. */
  paidInvoiceId?: string;
};

/** Two legs sharing a transferGroupId: negative at the origin, positive at the destination. */
export function buildTransfer(i: TransferInput): [out: NewTransaction, into: NewTransaction] {
  checkAmount(i.amountCents);
  if (i.fromAccountId === i.toAccountId) throw new Error("transfer needs two different accounts");
  const base = {
    kind: "transfer" as const,
    description: checkDescription(i.description),
    occurredAt: i.occurredAt,
    occurredOn: saoPauloDate(i.occurredAt),
    transferGroupId: i.transferGroupId,
  };
  return [
    { ...base, accountId: i.fromAccountId, amountCents: -i.amountCents },
    { ...base, accountId: i.toAccountId, amountCents: i.amountCents, paidInvoiceId: i.paidInvoiceId },
  ];
}

import { and, asc, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { newId } from "@/db/id";
import { accounts, categories, merchantRules, rawNotifications, transactions } from "@/db/schema";
import { normalizeMerchant, pickRefundTarget } from "@/domain/capture";
import { parseFinals } from "@/domain/accounts";
import { UserError } from "@/domain/errors";
import { buildEntry } from "@/domain/entries";
import { parseNotification } from "@/capture/parsers/parse";
import { PACKAGE_INSTITUTION, type CaptureEvent } from "@/capture/parsers/types";
import { createCardPurchase } from "./invoices";
import { createEntry, createTransfer, deleteTransaction, requireCategory } from "./transactions";

type Raw = typeof rawNotifications.$inferSelect;

const UNRECOGNIZED_MESSAGE = "Formato de notificação não reconhecido.";

/** `done: false` keeps the notification for a retry once the user registers what is missing. */
type Outcome = { done: boolean; error?: string };

function ruleFor(merchant: string | undefined, kind: "income" | "expense") {
  if (!merchant) return undefined;
  const row = db
    .select({ categoryId: merchantRules.categoryId, necessity: merchantRules.necessity, kind: categories.kind })
    .from(merchantRules)
    .innerJoin(categories, eq(categories.id, merchantRules.categoryId))
    .where(eq(merchantRules.pattern, normalizeMerchant(merchant)))
    .get();
  return row && row.kind === kind ? { categoryId: row.categoryId, necessity: row.necessity ?? undefined } : undefined;
}

function findCard(last4: string, institution: string | undefined) {
  const cards = db
    .select()
    .from(accounts)
    .where(and(eq(accounts.type, "credit_card"), eq(accounts.archived, false)))
    .all()
    .filter((c) => parseFinals(c.cardLast4).includes(last4));
  return cards.find((c) => c.institution === institution) ?? cards[0];
}

function handle(raw: Raw, event: CaptureEvent): Outcome {
  const institution = PACKAGE_INSTITUTION[raw.packageName];

  if (event.type === "money_in") {
    const candidates = db
      .select()
      .from(accounts)
      .where(and(eq(accounts.type, "checking"), eq(accounts.archived, false), eq(accounts.institution, institution)))
      .all();
    if (candidates.length !== 1) {
      return {
        done: false,
        error:
          candidates.length === 0
            ? "Cadastre uma conta corrente desta instituição para receber esta entrada."
            : "Há mais de uma conta corrente desta instituição; arquive as que não usa para a captura funcionar.",
      };
    }
    const rule = ruleFor(event.counterparty, "income");
    createEntry({
      accountId: candidates[0].id,
      kind: "income",
      amountCents: event.amountCents,
      description: event.counterparty ? `Pix de ${event.counterparty}` : "Entrada recebida",
      occurredAt: raw.postedAt,
      categoryId: rule?.categoryId,
      status: "pending",
      source: "notification",
      merchantRaw: event.counterparty,
      notes: event.message,
      rawNotificationId: raw.id,
    });
    return { done: true };
  }

  const card = findCard(event.cardLast4, institution);
  if (!card) {
    return { done: false, error: `Nenhum cartão com final ${event.cardLast4}. Informe o final na conta do cartão.` };
  }

  if (event.type === "card_purchase") {
    const rule = ruleFor(event.merchant, "expense");
    createCardPurchase({
      cardAccountId: card.id,
      totalCents: event.amountCents,
      description: event.merchant,
      occurredAt: raw.postedAt,
      categoryId: rule?.categoryId,
      necessity: rule?.necessity,
      source: "notification",
      status: "pending",
      merchantRaw: event.merchant,
      rawNotificationId: raw.id,
    });
    return { done: true };
  }

  // Refund: no amount in the notification, so it reverses the matching purchase on the same invoice.
  const purchases = db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, card.id),
        eq(transactions.kind, "expense"),
        isNull(transactions.deletedAt),
        isNotNull(transactions.invoiceId),
        isNotNull(transactions.merchantRaw),
      ),
    )
    .all();
  const refunded = new Set(
    db
      .select({ refundOfId: transactions.refundOfId })
      .from(transactions)
      .where(and(isNotNull(transactions.refundOfId), isNull(transactions.deletedAt)))
      .all()
      .map((r) => r.refundOfId),
  );
  const target = pickRefundTarget(
    event.merchant,
    purchases.map((p) => ({ id: p.id, merchantRaw: p.merchantRaw, occurredAt: p.occurredAt, refunded: refunded.has(p.id) })),
  );
  const original = purchases.find((p) => p.id === target?.id);
  if (!original) {
    return { done: true, error: "Compra original do estorno não encontrada. Lance o estorno pela tela do cartão." };
  }
  db.insert(transactions)
    .values({
      ...buildEntry({
        accountId: card.id,
        kind: "income",
        amountCents: Math.abs(original.amountCents),
        description: `Estorno: ${event.merchant}`,
        occurredAt: raw.postedAt,
        categoryId: original.categoryId ?? undefined,
        invoiceId: original.invoiceId!,
        status: "pending",
        source: "notification",
        merchantRaw: event.merchant,
        rawNotificationId: raw.id,
      }),
      kind: "adjustment", // a refund is neither income nor expense
      refundOfId: original.id,
      id: newId(),
    })
    .run();
  return { done: true };
}

/**
 * Turns unprocessed raw notifications into pending transactions, oldest first (a refund needs its purchase).
 * Safe to call any time: processed rows are flagged, and rows waiting for a registration are retried.
 * Returns how many transactions were created.
 */
export function processNotifications(): number {
  const rows = db
    .select()
    .from(rawNotifications)
    // Unrecognized ones are retried too: a parser fixed later turns them into transactions.
    .where(or(eq(rawNotifications.parsed, false), eq(rawNotifications.parseError, UNRECOGNIZED_MESSAGE)))
    .orderBy(asc(rawNotifications.postedAt))
    .all();
  let created = 0;
  for (const raw of rows) {
    try {
      db.transaction(() => {
        const parsed = parseNotification(raw);
        let outcome: Outcome;
        if (parsed.status === "ignored") outcome = { done: true };
        else if (parsed.status === "unrecognized") outcome = { done: true, error: UNRECOGNIZED_MESSAGE };
        else {
          outcome = handle(raw, parsed.event);
          if (outcome.done && !outcome.error) created++;
        }
        db.update(rawNotifications)
          .set({ parsed: outcome.done, parseError: outcome.error ?? null })
          .where(eq(rawNotifications.id, raw.id))
          .run();
      });
    } catch (e) {
      const message = e instanceof UserError ? e.message : "Erro ao processar a notificação.";
      db.update(rawNotifications).set({ parseError: message }).where(eq(rawNotifications.id, raw.id)).run();
    }
  }
  return created;
}

/** Gives up on a notification that will never be a transaction: it stops being retried and listed. */
export function dismissNotification(id: string): void {
  db.update(rawNotifications).set({ parsed: true, parseError: null }).where(eq(rawNotifications.id, id)).run();
}

export type InboxItem = {
  id: string;
  description: string;
  amountCents: number;
  kind: "income" | "expense" | "transfer" | "adjustment";
  accountName: string;
  occurredOn: string;
  categoryName: string | null;
};

/** Pending transactions waiting for the user's review, newest first. */
export function listInbox(): InboxItem[] {
  return db
    .select({
      id: transactions.id,
      description: transactions.description,
      amountCents: transactions.amountCents,
      kind: transactions.kind,
      accountName: accounts.name,
      occurredOn: transactions.occurredOn,
      categoryName: categories.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(eq(transactions.status, "pending"), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.occurredAt))
    .all();
}

export const inboxCount = (): number => listInbox().length;

/** Notifications that mention money but could not become a transaction, with the reason. */
export function listProblemNotifications(): { id: string; text: string; reason: string; retry: boolean }[] {
  return db
    .select()
    .from(rawNotifications)
    .where(isNotNull(rawNotifications.parseError))
    .orderBy(desc(rawNotifications.postedAt))
    .all()
    .map((r) => ({ id: r.id, text: r.bigText ?? r.text ?? r.title ?? "", reason: r.parseError!, retry: !r.parsed }));
}

export type InboxDetail = {
  id: string;
  kind: InboxItem["kind"];
  accountId: string;
  accountName: string;
  isCard: boolean;
  amountCents: number; // magnitude
  description: string;
  merchantRaw: string | null;
  occurredOn: string;
  categoryId: string | null;
  necessity: "essential" | "optional" | null;
  notificationText: string | null;
};

export function getInboxDetail(id: string): InboxDetail {
  const row = db
    .select({ t: transactions, a: accounts, raw: rawNotifications })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(rawNotifications, eq(rawNotifications.id, transactions.rawNotificationId))
    .where(and(eq(transactions.id, id), eq(transactions.status, "pending"), isNull(transactions.deletedAt)))
    .get();
  if (!row) throw new UserError("Lançamento pendente não encontrado.");
  return {
    id,
    kind: row.t.kind,
    accountId: row.a.id,
    accountName: row.a.name,
    isCard: row.a.type === "credit_card",
    amountCents: Math.abs(row.t.amountCents),
    description: row.t.description,
    merchantRaw: row.t.merchantRaw,
    occurredOn: row.t.occurredOn,
    categoryId: row.t.categoryId,
    necessity: row.t.necessity,
    notificationText: row.raw ? (row.raw.bigText ?? row.raw.text) : null,
  };
}

function learnRule(merchant: string | null, categoryId: string | undefined, necessity: "essential" | "optional" | undefined) {
  if (!merchant || !categoryId) return;
  db.insert(merchantRules)
    .values({ id: newId(), pattern: normalizeMerchant(merchant), categoryId, necessity: necessity ?? null })
    .onConflictDoUpdate({ target: merchantRules.pattern, set: { categoryId, necessity: necessity ?? null } })
    .run();
}

/**
 * Confirms a captured transaction with the user's corrections. A card purchase may be split into installments
 * (the notification shows the whole amount); the category is remembered for the merchant.
 */
export function confirmCaptured(
  id: string,
  c: { description: string; categoryId?: string; necessity?: "essential" | "optional"; installments?: number },
): void {
  const d = getInboxDetail(id);
  const description = c.description.trim();
  if (!description) throw new UserError("Informe uma descrição.");
  const installments = c.installments ?? 1;
  if (!Number.isInteger(installments) || installments < 1) throw new UserError("Informe o número de parcelas.");

  if (d.kind === "adjustment") {
    // A refund only needs confirming.
    db.update(transactions).set({ status: "confirmed" }).where(eq(transactions.id, id)).run();
    return;
  }
  requireCategory(c.categoryId, d.kind === "income" ? "income" : "expense");
  const necessity = d.kind === "expense" ? c.necessity : undefined;

  db.transaction(() => {
    if (d.isCard && installments > 1) {
      const original = db.select().from(transactions).where(eq(transactions.id, id)).get()!;
      db.update(transactions).set({ deletedAt: new Date().toISOString() }).where(eq(transactions.id, id)).run();
      createCardPurchase({
        cardAccountId: d.accountId,
        totalCents: d.amountCents,
        description,
        occurredAt: original.occurredAt,
        installments,
        categoryId: c.categoryId,
        necessity,
        source: "notification",
        merchantRaw: d.merchantRaw ?? undefined,
        rawNotificationId: original.rawNotificationId ?? undefined,
      });
    } else {
      db.update(transactions)
        .set({ description, categoryId: c.categoryId ?? null, necessity: necessity ?? null, status: "confirmed" })
        .where(eq(transactions.id, id))
        .run();
    }
    learnRule(d.merchantRaw, c.categoryId, necessity);
  });
}

/** An incoming Pix/deposit that is really money moved from another of the user's accounts. */
export function markAsOwnTransfer(id: string, fromAccountId: string): void {
  const d = getInboxDetail(id);
  if (d.kind !== "income") throw new UserError("Só uma entrada pode virar transferência entre contas.");
  const original = db.select().from(transactions).where(eq(transactions.id, id)).get()!;
  db.transaction(() => {
    db.update(transactions).set({ deletedAt: new Date().toISOString() }).where(eq(transactions.id, id)).run();
    createTransfer({
      fromAccountId,
      toAccountId: d.accountId,
      amountCents: d.amountCents,
      description: "Transferência entre minhas contas",
      occurredAt: original.occurredAt,
    });
  });
}

export const discardCaptured = (id: string): void => deleteTransaction(id);

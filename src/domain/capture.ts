/** Merchant names from notifications are compared case-insensitively, ignoring surrounding spaces. */
export const normalizeMerchant = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, " ");

export type RefundCandidate = { id: string; merchantRaw: string | null; occurredAt: string; refunded: boolean };

/**
 * Which purchase a refund notification reverses: the most recent one from the same merchant that has not
 * been refunded yet. The notification carries no amount or date, so merchant and recency are all there is.
 */
export function pickRefundTarget(merchant: string, purchases: RefundCandidate[]): RefundCandidate | undefined {
  const wanted = normalizeMerchant(merchant);
  return purchases
    .filter((p) => !p.refunded && p.merchantRaw !== null && normalizeMerchant(p.merchantRaw) === wanted)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
}

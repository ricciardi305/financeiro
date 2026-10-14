export type RawInput = {
  packageName: string;
  title: string | null;
  text: string | null;
  bigText: string | null;
};

export type Institution = "nubank" | "inter" | "mercadopago";

/** What a bank notification means for the books. Only what real samples showed is recognized. */
export type CaptureEvent =
  | { type: "card_purchase"; amountCents: number; merchant: string; cardLast4: string }
  /** The notification carries no amount: it is matched to the original purchase by merchant and card. */
  | { type: "card_refund"; merchant: string; cardLast4: string }
  /** Money arrived in the account (Pix, transfer or deposit). The counterparty and the sender's message are not always given. */
  | { type: "money_in"; amountCents: number; counterparty?: string; message?: string };

export type ParseResult =
  | { status: "event"; event: CaptureEvent }
  /** Nothing financial (marketing, card checks, empty group summaries). */
  | { status: "ignored" }
  /** Mentions money but matches no known layout: shown to the user instead of being dropped. */
  | { status: "unrecognized" };

export const PACKAGE_INSTITUTION: Record<string, Institution> = {
  "com.nu.production": "nubank",
  "br.com.intermedium": "inter",
  "com.mercadopago.wallet": "mercadopago",
};

/** "R$ 1.234,56" -> 123456 */
export function parseBrl(text: string): number | null {
  const m = /R\$\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/.exec(text);
  if (!m) return null;
  return Number(m[1].replace(/\./g, "")) * 100 + Number(m[2]);
}

export const MONEY = /R\$\s*\d/;

export const ignored: ParseResult = { status: "ignored" };
export const unrecognized: ParseResult = { status: "unrecognized" };
export const found = (event: CaptureEvent): ParseResult => ({ status: "event", event });

/** Real texts use non-breaking spaces (U+00A0), e.g. between "R$" and the amount; compare with plain ones. */
const plain = (s: string): string => s.replace(/[\u00a0\u202f]/g, " ").trim();

/** Message text of a notification: the expanded text when present. */
export const bodyOf = (n: RawInput): string => plain(n.bigText ?? n.text ?? "");

export const titleOf = (n: RawInput): string => plain(n.title ?? "");

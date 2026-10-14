import { bodyOf, titleOf, found, ignored, MONEY, parseBrl, unrecognized, type ParseResult, type RawInput } from "./types";

export function parseInter(n: RawInput): ParseResult {
  const body = bodyOf(n);
  if (!MONEY.test(body)) return ignored;

  if (titleOf(n) === "Pix recebido") {
    const m = /^(.+?) te enviou um Pix de (R\$ [\d.,]+)/.exec(body);
    const cents = m && parseBrl(m[2]);
    // The sender can attach a message: "...conta final ***1111-1.- message".
    const message = /conta final [*\d-]+\.\s*-\s*(.+)$/.exec(body)?.[1];
    if (m && cents) return found({ type: "money_in", amountCents: cents, counterparty: m[1], message });
  }

  if (titleOf(n) === "Compra no crédito") {
    const m = /você acaba de comprar (R\$ [\d.,]+) em (.+?)\. A compra foi no crédito.*cartão final (\d{4})/i.exec(body);
    const cents = m && parseBrl(m[1]);
    if (m && cents) return found({ type: "card_purchase", amountCents: cents, merchant: m[2], cardLast4: m[3] });
  }

  return unrecognized;
}

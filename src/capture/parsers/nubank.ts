import { bodyOf, titleOf, found, ignored, MONEY, parseBrl, unrecognized, type ParseResult, type RawInput } from "./types";

export function parseNubank(n: RawInput): ParseResult {
  const body = bodyOf(n);

  // The refund text has no amount, so it is checked before the "has money" gate.
  if (titleOf(n) === "Compra no crédito estornada") {
    const m = /estorno referente à compra em (.+?) no cartão com final (\d{4})/.exec(body);
    return m ? found({ type: "card_refund", merchant: m[1], cardLast4: m[2] }) : unrecognized;
  }

  if (!MONEY.test(body)) return ignored;

  if (titleOf(n) === "Compra no crédito aprovada") {
    const m = /^Compra de (R\$ [\d.,]+) APROVADA em (.+?) para o cartão com final (\d{4})/.exec(body);
    const cents = m && parseBrl(m[1]);
    if (m && cents) return found({ type: "card_purchase", amountCents: cents, merchant: m[2], cardLast4: m[3] });
  }

  if (titleOf(n) === "Transferência recebida") {
    const m = /^Recebemos sua transferência de (R\$ [\d.,]+)/.exec(body);
    const cents = m && parseBrl(m[1]);
    if (m && cents) return found({ type: "money_in", amountCents: cents });
  }

  return unrecognized;
}

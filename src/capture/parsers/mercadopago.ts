import { bodyOf, titleOf, found, ignored, MONEY, parseBrl, unrecognized, type ParseResult, type RawInput } from "./types";

export function parseMercadoPago(n: RawInput): ParseResult {
  const body = bodyOf(n);
  if (!MONEY.test(body)) return ignored;

  if (titleOf(n) === "Seu dinheiro já está disponível") {
    const m = /^Você depositou (R\$ [\d.,]+) via Pix/.exec(body);
    const cents = m && parseBrl(m[1]);
    if (m && cents) return found({ type: "money_in", amountCents: cents });
  }

  return unrecognized;
}

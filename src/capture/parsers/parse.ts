import { parseInter } from "./inter";
import { parseMercadoPago } from "./mercadopago";
import { parseNubank } from "./nubank";
import { ignored, type ParseResult, type RawInput } from "./types";

/** Entry point: routes a raw notification to its bank's parser. Unknown packages are ignored. */
export function parseNotification(n: RawInput): ParseResult {
  switch (n.packageName) {
    case "br.com.intermedium":
      return parseInter(n);
    case "com.nu.production":
      return parseNubank(n);
    case "com.mercadopago.wallet":
      return parseMercadoPago(n);
    default:
      return ignored;
  }
}

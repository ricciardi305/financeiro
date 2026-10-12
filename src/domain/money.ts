const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatCents = (cents: number): string => brl.format(cents / 100);

/**
 * Cents-first money input: only the digits count, so "10" is 0,10 and "1023" is 10,23.
 * A "-" anywhere makes it negative (when allowed).
 */
export function centsFromTyped(text: string, allowNegative = false): number {
  const n = Number(text.replace(/\D/g, "").slice(0, 12) || "0");
  return allowNegative && text.includes("-") && n > 0 ? -n : n;
}

/** "10,23" / "-1.234,56" for the input; no currency symbol. */
export function formatInputCents(cents: number): string {
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cents < 0 ? "-" : ""}${reais},${String(abs % 100).padStart(2, "0")}`;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Digits only, shaped as dd/mm/aaaa while typing. */
export function maskDate(text: string): string {
  const d = text.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "dd/mm/aaaa" -> "YYYY-MM-DD", or null when it is not a real calendar date. */
export function parseBrDate(text: string): string | null {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 2000) return null;
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** "YYYY-MM-DD" -> "dd/mm/aaaa". */
export const isoDateToBr = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Instant for a manually typed day: noon in São Paulo (UTC-3, no DST since 2019), so the day never flips. */
export const noonInSaoPaulo = (isoDate: string): string => new Date(`${isoDate}T12:00:00-03:00`).toISOString();

/** "YYYY-MM" shifted by `delta` months. */
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** Half-open date range [from, to) covering the month, as YYYY-MM-DD strings. */
export function monthRange(ym: string): { from: string; to: string } {
  return { from: `${ym}-01`, to: `${shiftMonth(ym, 1)}-01` };
}

/** Number of days in a "YYYY-MM" month. */
export function daysInMonth(ym: string): number {
  return new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
}

/** "YYYY-MM-DD" for `day` of the month, clamped to the month's last day (31 in April -> 30). */
export function clampedDate(ym: string, day: number): string {
  return `${ym}-${String(Math.min(day, daysInMonth(ym))).padStart(2, "0")}`;
}

/** The same day `n` months later, clamped to the month's last day (Jan 31 + 1 -> Feb 28/29). */
export function addMonthsClamped(isoDate: string, n: number): string {
  return clampedDate(shiftMonth(isoDate.slice(0, 7), n), Number(isoDate.slice(8, 10)));
}

/** "outubro de 2026". */
export function monthLabel(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} de ${ym.slice(0, 4)}`;
}

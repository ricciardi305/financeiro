import { saoPauloDate } from "./entries";
import {
  addMonthsClamped,
  clampedDate,
  daysInMonth,
  isoDateToBr,
  maskDate,
  monthLabel,
  monthRange,
  noonInSaoPaulo,
  parseBrDate,
  shiftMonth,
} from "./dates";

test("month length, clamped days and month shifts keep the calendar valid", () => {
  expect(daysInMonth("2026-02")).toBe(28);
  expect(daysInMonth("2028-02")).toBe(29);
  expect(daysInMonth("2026-12")).toBe(31);
  expect(clampedDate("2026-04", 31)).toBe("2026-04-30");
  expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
  expect(addMonthsClamped("2026-12-15", 2)).toBe("2027-02-15");
});

test("mask shapes digits as dd/mm/aaaa", () => {
  expect(maskDate("1")).toBe("1");
  expect(maskDate("123")).toBe("12/3");
  expect(maskDate("12102026")).toBe("12/10/2026");
  expect(maskDate("12/10/2026999")).toBe("12/10/2026");
  expect(maskDate("ab1x2")).toBe("12");
});

test("parses only real calendar dates", () => {
  expect(parseBrDate("12/10/2026")).toBe("2026-10-12");
  expect(parseBrDate("29/02/2028")).toBe("2028-02-29");
  expect(parseBrDate("29/02/2027")).toBeNull();
  expect(parseBrDate("31/04/2026")).toBeNull();
  expect(parseBrDate("00/10/2026")).toBeNull();
  expect(parseBrDate("12/13/2026")).toBeNull();
  expect(parseBrDate("12/10/26")).toBeNull();
  expect(parseBrDate("12/10/1999")).toBeNull();
  expect(isoDateToBr("2026-10-12")).toBe("12/10/2026");
});

test("typed day maps back to the same São Paulo day", () => {
  for (const d of ["2026-01-01", "2026-12-31", "2028-02-29"]) {
    expect(saoPauloDate(noonInSaoPaulo(d))).toBe(d);
  }
});

test("month navigation crosses years and builds half-open ranges", () => {
  expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  expect(shiftMonth("2026-10", -22)).toBe("2024-12");
  expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2027-01-01" });
  expect(monthLabel("2026-03")).toBe("março de 2026");
});

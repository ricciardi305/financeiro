import { centsFromTyped, formatCents, formatInputCents } from "./money";

test("formats cents as BRL", () => {
  expect(formatCents(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  expect(formatCents(-5).replace(/\s/g, " ")).toBe("-R$ 0,05");
});

test("typed digits are read as cents", () => {
  expect(centsFromTyped("")).toBe(0);
  expect(centsFromTyped("1")).toBe(1);
  expect(centsFromTyped("10")).toBe(10);
  expect(centsFromTyped("1023")).toBe(1023);
  expect(centsFromTyped("1.234,56")).toBe(123456); // re-typing over a formatted value
  expect(centsFromTyped("abc12x")).toBe(12);
  expect(centsFromTyped("1".repeat(20)).toString()).toHaveLength(12); // capped, stays a safe integer
});

test("minus sign only counts when negatives are allowed", () => {
  expect(centsFromTyped("-500")).toBe(500);
  expect(centsFromTyped("-500", true)).toBe(-500);
  expect(centsFromTyped("-", true)).toBe(0);
});

test("formats cents for the input field", () => {
  expect(formatInputCents(0)).toBe("0,00");
  expect(formatInputCents(10)).toBe("0,10");
  expect(formatInputCents(1023)).toBe("10,23");
  expect(formatInputCents(123456789)).toBe("1.234.567,89");
  expect(formatInputCents(-5)).toBe("-0,05");
});

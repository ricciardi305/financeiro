import { formatCents } from "./money";

test("formats cents as BRL", () => {
  expect(formatCents(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  expect(formatCents(-5).replace(/\s/g, " ")).toBe("-R$ 0,05");
});

import { buildEntry, buildTransfer, saoPauloDate } from "./entries";

const base = { accountId: "a", description: " Mercado ", occurredAt: "2026-10-12T15:00:00Z" };

test("expense is stored negative, income positive, description trimmed", () => {
  const e = buildEntry({ ...base, kind: "expense", amountCents: 1990 });
  expect(e.amountCents).toBe(-1990);
  expect(e.description).toBe("Mercado");
  expect(buildEntry({ ...base, kind: "income", amountCents: 500 }).amountCents).toBe(500);
});

test("rejects zero, negative, fractional amounts and blank description", () => {
  for (const amountCents of [0, -5, 1.5, NaN]) {
    expect(() => buildEntry({ ...base, kind: "expense", amountCents })).toThrow();
  }
  expect(() => buildEntry({ ...base, kind: "income", amountCents: 1, description: "  " })).toThrow();
});

test("transfer legs cancel out and share the group", () => {
  const [out, into] = buildTransfer({
    fromAccountId: "a",
    toAccountId: "b",
    amountCents: 12_345,
    description: "Pix",
    occurredAt: base.occurredAt,
    transferGroupId: "g1",
    paidInvoiceId: "inv",
  });
  expect(out.amountCents + into.amountCents).toBe(0);
  expect(out.amountCents).toBeLessThan(0);
  expect([out.transferGroupId, into.transferGroupId]).toEqual(["g1", "g1"]);
  expect(out.paidInvoiceId).toBeUndefined();
  expect(into.paidInvoiceId).toBe("inv");
  expect(() =>
    buildTransfer({
      fromAccountId: "a",
      toAccountId: "a",
      amountCents: 1,
      description: "x",
      occurredAt: base.occurredAt,
      transferGroupId: "g",
    }),
  ).toThrow();
});

test("São Paulo date flips at 03:00Z (UTC-3), including year change", () => {
  expect(saoPauloDate("2026-10-13T02:59:59Z")).toBe("2026-10-12");
  expect(saoPauloDate("2026-10-13T03:00:00Z")).toBe("2026-10-13");
  expect(saoPauloDate("2027-01-01T02:00:00Z")).toBe("2026-12-31");
});

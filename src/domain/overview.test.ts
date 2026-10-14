import { liquidBalance, netWorth, projectedEndBalance, spendingBreakdown, type AccountKind } from "./overview";

const accs: { type: AccountKind; balanceCents: number }[] = [
  { type: "checking", balanceCents: 500000 },
  { type: "cash", balanceCents: 20000 },
  { type: "investment", balanceCents: 1000000 },
  { type: "credit_card", balanceCents: -150000 }, // already shown through the invoice debt
];

test("net worth leaves cards out of the sum and subtracts open invoices once", () => {
  expect(netWorth(accs, 150000)).toEqual({ assetsCents: 1520000, debtCents: 150000, netCents: 1370000 });
});

test("liquid balance is checking plus wallet only", () => {
  expect(liquidBalance(accs)).toBe(520000);
});

describe("spending breakdown", () => {
  const rows = [
    { amountCents: -30000, categoryName: "Mercado", necessity: "essential" as const },
    { amountCents: -20000, categoryName: "Lazer", necessity: "optional" as const },
    { amountCents: -10000, categoryName: "Mercado", necessity: "essential" as const },
    { amountCents: 5000, categoryName: "Lazer", necessity: null }, // refund
    { amountCents: -1000, categoryName: null, necessity: null },
  ];
  const b = spendingBreakdown(rows);
  test("totals net of refunds, biggest category first", () => {
    expect(b.totalCents).toBe(56000);
    expect(b.byCategory).toEqual([
      { name: "Mercado", cents: 40000 },
      { name: "Lazer", cents: 15000 },
      { name: "Sem categoria", cents: 1000 },
    ]);
  });
  test("necessity split", () => {
    expect(b.byNecessity).toEqual({ essentialCents: 40000, optionalCents: 20000, unclassifiedCents: -4000 });
  });
  test("empty", () => {
    expect(spendingBreakdown([])).toEqual({
      totalCents: 0,
      byCategory: [],
      byNecessity: { essentialCents: 0, optionalCents: 0, unclassifiedCents: 0 },
    });
  });
});

test("projected end balance", () => {
  expect(
    projectedEndBalance({ liquidCents: 520000, pendingIncomeCents: 400000, pendingExpenseCents: 150000, invoicesDueCents: 200000 }),
  ).toBe(570000);
});

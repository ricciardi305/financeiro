import { accountBalance } from "./balance";

test("initial + confirmed; pending apart; deleted ignored", () => {
  const b = accountBalance(10_000, [
    { amountCents: -2_500, status: "confirmed" },
    { amountCents: 50_000, status: "confirmed" },
    { amountCents: -1_000, status: "pending" },
    { amountCents: -99_999, status: "confirmed", deletedAt: "2026-01-01T00:00:00Z" },
  ]);
  expect(b).toEqual({ confirmedCents: 57_500, pendingCents: -1_000, projectedCents: 56_500 });
});

test("no transactions returns the initial balance", () => {
  expect(accountBalance(-300, [])).toEqual({ confirmedCents: -300, pendingCents: 0, projectedCents: -300 });
});

import { investmentValue, snapshotRows, totalYield, validateSnapshot } from "./investments";

describe("current value", () => {
  const flows = [
    { occurredOn: "2026-10-01", amountCents: 100000 },
    { occurredOn: "2026-10-10", amountCents: 50000 },
    { occurredOn: "2026-10-20", amountCents: -20000 },
  ];
  test("without a snapshot: initial balance plus every flow", () => {
    expect(investmentValue(10000, [], flows)).toBe(140000);
  });
  test("with a snapshot: its balance plus only later flows (same-day ones are inside it)", () => {
    expect(investmentValue(10000, [{ date: "2026-10-10", balanceCents: 160000 }], flows)).toBe(140000);
  });
  test("uses the latest snapshot whatever the order", () => {
    const snaps = [
      { date: "2026-10-20", balanceCents: 300000 },
      { date: "2026-10-01", balanceCents: 1 },
    ];
    expect(investmentValue(0, snaps, flows)).toBe(300000);
  });
});

describe("yield per period", () => {
  const snaps = [
    { date: "2026-09-30", balanceCents: 100000 },
    { date: "2026-10-31", balanceCents: 163000 },
    { date: "2026-11-30", balanceCents: 163000 },
  ];
  const flows = [
    { occurredOn: "2026-10-05", amountCents: 50000 }, // contribution
    { occurredOn: "2026-10-31", amountCents: 10000 }, // on the snapshot day: belongs to October
    { occurredOn: "2026-11-15", amountCents: -2000 }, // redemption
  ];
  const rows = snapshotRows(snaps, flows);
  test("first snapshot has no period", () => {
    expect(rows[0]).toEqual({ ...snaps[0], flowCents: null, yieldCents: null });
  });
  test("yield = balance change minus net flow", () => {
    expect(rows[1]).toMatchObject({ flowCents: 60000, yieldCents: 3000 });
    expect(rows[2]).toMatchObject({ flowCents: -2000, yieldCents: 2000 });
    expect(totalYield(rows)).toBe(5000);
  });
  test("input order does not matter", () => {
    expect(snapshotRows([...snaps].reverse(), flows)).toEqual(rows);
  });
});

test("snapshot validation", () => {
  expect(() => validateSnapshot({ date: "2026-10-14", balanceCents: -1 }, "2026-10-14")).toThrow("saldo");
  expect(() => validateSnapshot({ date: "2026-10-15", balanceCents: 1 }, "2026-10-14")).toThrow("futuro");
  expect(validateSnapshot({ date: "2026-10-14", balanceCents: 0 }, "2026-10-14").balanceCents).toBe(0);
});

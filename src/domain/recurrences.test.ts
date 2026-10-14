import {
  appliesToMonth,
  occurrenceDueDate,
  occurrenceMonths,
  occurrenceState,
  totalsForKind,
  validateRecurrence,
  type MonthItem,
  type RecurrenceInput,
} from "./recurrences";

const base: RecurrenceInput = {
  description: " Internet ",
  kind: "expense",
  accountId: "acc",
  amountCents: 9990,
  isVariableAmount: false,
  dayOfMonth: 10,
  startMonth: "2026-10",
  necessity: "essential",
};

describe("validation", () => {
  test("trims the description and keeps necessity only for expenses", () => {
    expect(validateRecurrence(base).description).toBe("Internet");
    expect(validateRecurrence({ ...base, kind: "income" }).necessity).toBeUndefined();
  });
  test("friendly messages for bad input", () => {
    expect(() => validateRecurrence({ ...base, description: " " })).toThrow("Informe uma descrição.");
    expect(() => validateRecurrence({ ...base, amountCents: 0 })).toThrow("valor previsto");
    expect(() => validateRecurrence({ ...base, dayOfMonth: 0 })).toThrow("dia do mês");
    expect(() => validateRecurrence({ ...base, dayOfMonth: 32 })).toThrow("dia do mês");
    expect(() => validateRecurrence({ ...base, accountId: "" })).toThrow("Escolha a conta.");
    expect(() => validateRecurrence({ ...base, startMonth: "2026-13" })).toThrow("Mês inicial");
    expect(() => validateRecurrence({ ...base, endMonth: "2026-09" })).toThrow("antes do inicial");
  });
});

describe("which months get an occurrence", () => {
  const today = "2026-10-13";
  test("current and next month for a recurrence that starts now", () => {
    expect(occurrenceMonths({ startMonth: "2026-10", active: true }, today)).toEqual(["2026-10", "2026-11"]);
  });
  test("catches up on missed months since the start", () => {
    expect(occurrenceMonths({ startMonth: "2026-08", active: true }, today)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });
  test("a future start waits; a month beyond next is not generated", () => {
    expect(occurrenceMonths({ startMonth: "2026-11", active: true }, today)).toEqual(["2026-11"]);
    expect(occurrenceMonths({ startMonth: "2026-12", active: true }, today)).toEqual([]);
  });
  test("stops at the end month and never for inactive ones", () => {
    expect(occurrenceMonths({ startMonth: "2026-09", endMonth: "2026-10", active: true }, today)).toEqual([
      "2026-09",
      "2026-10",
    ]);
    expect(occurrenceMonths({ startMonth: "2026-10", active: false }, today)).toEqual([]);
  });
  test("year rollover", () => {
    expect(occurrenceMonths({ startMonth: "2026-12", active: true }, "2026-12-20")).toEqual(["2026-12", "2027-01"]);
  });
});

test("a recurrence applies to any month between start and end, only while active", () => {
  const open = { startMonth: "2026-10", active: true };
  expect(appliesToMonth(open, "2026-09")).toBe(false);
  expect(appliesToMonth(open, "2026-10")).toBe(true);
  expect(appliesToMonth(open, "2030-05")).toBe(true); // no end month: projected indefinitely
  expect(appliesToMonth({ ...open, endMonth: "2026-12" }, "2026-12")).toBe(true);
  expect(appliesToMonth({ ...open, endMonth: "2026-12" }, "2027-01")).toBe(false);
  expect(appliesToMonth({ ...open, active: false }, "2026-11")).toBe(false);
});

test("due date clamps the day to short months", () => {
  expect(occurrenceDueDate("2026-10", 10)).toBe("2026-10-10");
  expect(occurrenceDueDate("2026-02", 31)).toBe("2026-02-28");
  expect(occurrenceDueDate("2028-02", 31)).toBe("2028-02-29");
  expect(occurrenceDueDate("2026-04", 31)).toBe("2026-04-30");
});

test("late is derived from a planned occurrence past its due date", () => {
  expect(occurrenceState("planned", "2026-10-12", "2026-10-13")).toBe("late");
  expect(occurrenceState("planned", "2026-10-13", "2026-10-13")).toBe("planned");
  expect(occurrenceState("paid", "2026-09-01", "2026-10-13")).toBe("paid");
  expect(occurrenceState("skipped", "2026-09-01", "2026-10-13")).toBe("skipped");
});

describe("month totals", () => {
  const items: MonthItem[] = [
    { kind: "expense", state: "paid", expectedCents: 10000, paidCents: 12000 }, // real amount differs
    { kind: "expense", state: "planned", expectedCents: 5000, paidCents: null },
    { kind: "expense", state: "late", expectedCents: 3000, paidCents: null },
    { kind: "expense", state: "skipped", expectedCents: 9999, paidCents: null },
    { kind: "income", state: "planned", expectedCents: 400000, paidCents: null },
  ];
  test("paid uses the real amount, pending the expected one, skipped counts for nothing", () => {
    expect(totalsForKind(items, "expense")).toEqual({ expectedCents: 20000, paidCents: 12000, pendingCents: 8000 });
  });
  test("kinds are separate", () => {
    expect(totalsForKind(items, "income")).toEqual({ expectedCents: 400000, paidCents: 0, pendingCents: 400000 });
  });
});

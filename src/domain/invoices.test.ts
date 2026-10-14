import {
  closingDateFor,
  dueDateFor,
  invoiceMonthFor,
  invoiceStatus,
  isOverdue,
  planInstallments,
  splitInstallments,
  summarizeInvoice,
} from "./invoices";

describe("which invoice a purchase lands on (closing day 25)", () => {
  test("day before closing stays; the closing day and later go to the next", () => {
    expect(invoiceMonthFor("2026-10-24", 25)).toBe("2026-10");
    expect(invoiceMonthFor("2026-10-25", 25)).toBe("2026-11");
    expect(invoiceMonthFor("2026-10-31", 25)).toBe("2026-11");
    expect(invoiceMonthFor("2026-10-01", 25)).toBe("2026-10");
  });
  test("year rollover", () => {
    expect(invoiceMonthFor("2026-12-24", 25)).toBe("2026-12");
    expect(invoiceMonthFor("2026-12-25", 25)).toBe("2027-01");
    expect(invoiceMonthFor("2027-01-24", 25)).toBe("2027-01");
  });
  test("closing day 31 uses the last day of short months", () => {
    expect(closingDateFor("2026-04", 31)).toBe("2026-04-30");
    expect(closingDateFor("2026-02", 31)).toBe("2026-02-28");
    expect(closingDateFor("2028-02", 31)).toBe("2028-02-29");
    expect(invoiceMonthFor("2026-04-29", 31)).toBe("2026-04");
    expect(invoiceMonthFor("2026-04-30", 31)).toBe("2026-05"); // closing day of a 30-day month
    expect(invoiceMonthFor("2026-02-28", 31)).toBe("2026-03");
  });
  test("closing day 1: purchases on the 1st already belong to the next", () => {
    expect(invoiceMonthFor("2026-10-01", 1)).toBe("2026-11");
    expect(invoiceMonthFor("2026-09-30", 1)).toBe("2026-10");
  });
});

describe("due date", () => {
  test("later in the same month when dueDay is after closing", () => {
    expect(dueDateFor("2026-10", 20, 27)).toBe("2026-10-27");
  });
  test("next month when dueDay is on or before closing", () => {
    expect(dueDateFor("2026-10", 25, 5)).toBe("2026-11-05");
    expect(dueDateFor("2026-10", 25, 25)).toBe("2026-11-25");
    expect(dueDateFor("2026-12", 25, 5)).toBe("2027-01-05");
  });
  test("clamps a short month", () => {
    expect(dueDateFor("2026-01", 20, 31)).toBe("2026-01-31");
    expect(dueDateFor("2026-02", 25, 30)).toBe("2026-02-28"); // day 30 clamped to Feb 28, still after closing
    expect(dueDateFor("2026-01", 31, 30)).toBe("2026-02-28"); // not after Jan 31 -> next month, clamped
  });
});

describe("installments", () => {
  test("rounding difference goes to the first installment and the sum is exact", () => {
    expect(splitInstallments(1000, 3)).toEqual([334, 333, 333]);
    expect(splitInstallments(1000, 4)).toEqual([250, 250, 250, 250]);
    expect(splitInstallments(10_001, 3).reduce((a, b) => a + b, 0)).toBe(10_001);
    expect(splitInstallments(500, 1)).toEqual([500]);
  });
  test("rejects bad counts and amounts too small to split", () => {
    expect(() => splitInstallments(1000, 0)).toThrow("Informe de 1 a 99 parcelas.");
    expect(() => splitInstallments(1000, 100)).toThrow();
    expect(() => splitInstallments(2, 3)).toThrow("pequeno demais");
  });
  test("one charge per consecutive invoice, across the year end", () => {
    const plan = planInstallments({ occurredOn: "2026-11-30", closingDay: 25, totalCents: 1200, installments: 3 });
    expect(plan.map((p) => p.referenceMonth)).toEqual(["2026-12", "2027-01", "2027-02"]);
    expect(plan.map((p) => p.amountCents)).toEqual([400, 400, 400]);
    expect(plan.map((p) => p.occurredOn)).toEqual(["2026-11-30", "2026-12-30", "2027-01-30"]);
  });
  test("a purchase on the 31st keeps the day clamped in short months", () => {
    const plan = planInstallments({ occurredOn: "2026-01-31", closingDay: 31, totalCents: 300, installments: 3 });
    expect(plan.map((p) => p.occurredOn)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(plan.map((p) => p.referenceMonth)).toEqual(["2026-02", "2026-03", "2026-04"]);
  });
  test("manual month offset moves the whole plan", () => {
    const plan = planInstallments({
      occurredOn: "2026-10-10",
      closingDay: 25,
      totalCents: 200,
      installments: 2,
      monthOffset: 1,
    });
    expect(plan.map((p) => p.referenceMonth)).toEqual(["2026-11", "2026-12"]);
  });
});

describe("invoice summary and derived status", () => {
  test("total is the negated sum of charges; refunds reduce it", () => {
    expect(summarizeInvoice([-5000, -2500, 1000], [])).toEqual({ totalCents: 6500, paidCents: 0, remainingCents: 6500 });
    expect(summarizeInvoice([-5000], [2000, 1000])).toEqual({ totalCents: 5000, paidCents: 3000, remainingCents: 2000 });
  });
  test("an overpaid invoice has no remaining", () => {
    expect(summarizeInvoice([-1000], [1500]).remainingCents).toBe(0);
  });
  test("status by date and payments", () => {
    const closing = "2026-10-25";
    const s = (total: number, paid: number) => summarizeInvoice([-total], paid ? [paid] : []);
    expect(invoiceStatus(s(5000, 0), closing, "2026-10-24")).toBe("open");
    expect(invoiceStatus(s(5000, 5000), closing, "2026-10-20")).toBe("open"); // paid early, still accumulating
    expect(invoiceStatus(s(5000, 0), closing, "2026-10-25")).toBe("closed");
    expect(invoiceStatus(s(5000, 2000), closing, "2026-11-01")).toBe("partially_paid");
    expect(invoiceStatus(s(5000, 5000), closing, "2026-11-01")).toBe("paid");
    expect(invoiceStatus(summarizeInvoice([], []), closing, "2026-11-01")).toBe("paid"); // nothing to pay
  });
  test("overdue only when closed or partial and past the due date", () => {
    expect(isOverdue("closed", "2026-11-05", "2026-11-06")).toBe(true);
    expect(isOverdue("closed", "2026-11-05", "2026-11-05")).toBe(false);
    expect(isOverdue("paid", "2026-11-05", "2026-12-01")).toBe(false);
    expect(isOverdue("open", "2026-11-05", "2026-12-01")).toBe(false);
  });
});

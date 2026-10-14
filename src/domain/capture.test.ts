import { normalizeMerchant, pickRefundTarget } from "./capture";

test("merchant names compare ignoring case and extra spaces", () => {
  expect(normalizeMerchant("  MLP*Magalu-Multimegami ")).toBe("mlp*magalu-multimegami");
  expect(normalizeMerchant("Padaria   do  Zé")).toBe("padaria do zé");
});

describe("refund target", () => {
  const p = (id: string, merchantRaw: string | null, occurredAt: string, refunded = false) => ({
    id,
    merchantRaw,
    occurredAt,
    refunded,
  });
  test("the most recent unrefunded purchase of the merchant", () => {
    const list = [
      p("old", "MLP*Magalu", "2026-10-01T12:00:00.000Z"),
      p("new", "mlp*magalu", "2026-10-10T12:00:00.000Z"),
      p("other", "Padaria", "2026-10-12T12:00:00.000Z"),
    ];
    expect(pickRefundTarget("MLP*Magalu", list)?.id).toBe("new");
  });
  test("skips purchases already refunded, so two refunds hit two purchases", () => {
    const list = [p("old", "MLP*Magalu", "2026-10-01T12:00:00.000Z"), p("new", "MLP*Magalu", "2026-10-10T12:00:00.000Z", true)];
    expect(pickRefundTarget("MLP*Magalu", list)?.id).toBe("old");
  });
  test("nothing to match", () => {
    expect(pickRefundTarget("MLP*Magalu", [p("x", null, "2026-10-01T12:00:00.000Z")])).toBeUndefined();
    expect(pickRefundTarget("MLP*Magalu", [])).toBeUndefined();
  });
});

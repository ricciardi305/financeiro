import { samples } from "./__fixtures__/samples";
import { parseNotification } from "./parse";
import { parseBrl } from "./types";

const event = (s: Parameters<typeof parseNotification>[0]) => {
  const r = parseNotification(s);
  if (r.status !== "event") throw new Error(`expected event, got ${r.status}`);
  return r.event;
};

test("parseBrl reads Brazilian amounts into cents", () => {
  expect(parseBrl("R$ 0,01")).toBe(1);
  expect(parseBrl("R$ 46,90")).toBe(4690);
  expect(parseBrl("R$ 1.234,56")).toBe(123456);
  expect(parseBrl("sem valor")).toBeNull();
});

describe("Inter", () => {
  test("Pix received", () => {
    expect(event(samples.interPixReceived)).toEqual({
      type: "money_in",
      amountCents: 123456,
      counterparty: "Maria Souza Lima",
      message: undefined,
    });
  });
  test("Pix with a message from the sender", () => {
    expect(event(samples.interPixReceivedWithMessage)).toEqual({
      type: "money_in",
      amountCents: 1,
      counterparty: "Maria Souza Lima",
      message: "Teste de notificacao",
    });
  });
  test("credit card purchase keeps the merchant star and dots", () => {
    expect(event(samples.interCreditPurchase)).toEqual({
      type: "card_purchase",
      amountCents: 4690,
      merchant: "MERCADOLIVRE*MERCADOL",
      cardLast4: "1234",
    });
  });
});

describe("Nubank", () => {
  test("credit card purchase", () => {
    expect(event(samples.nubankCreditPurchase)).toEqual({
      type: "card_purchase",
      amountCents: 12009,
      merchant: "MLP*Magalu-Multimegami",
      cardLast4: "5678",
    });
  });
  test("refund has no amount, only merchant and card", () => {
    expect(event(samples.nubankCreditRefund)).toEqual({
      type: "card_refund",
      merchant: "MLP*Magalu-Multimegami",
      cardLast4: "5678",
    });
  });
  test("transfer received", () => {
    expect(event(samples.nubankTransferReceived)).toEqual({ type: "money_in", amountCents: 1 });
  });
  test("card check, marketing and empty group summary are ignored", () => {
    for (const s of [samples.nubankCardVerified, samples.nubankMarketing, samples.nubankEmptyGroup]) {
      expect(parseNotification(s).status).toBe("ignored");
    }
  });
});

describe("Mercado Pago", () => {
  test("Pix deposit", () => {
    expect(event(samples.mercadoPagoDeposit)).toEqual({ type: "money_in", amountCents: 1 });
  });
  test("marketing is ignored", () => {
    expect(parseNotification(samples.mercadoPagoMarketing).status).toBe("ignored");
  });
});

test("a notification with money in an unknown layout is unrecognized, never dropped", () => {
  expect(parseNotification(samples.interUnknownWithMoney).status).toBe("unrecognized");
});

test("other apps are ignored", () => {
  expect(parseNotification({ packageName: "com.whatsapp", title: "x", text: "R$ 5,00", bigText: null }).status).toBe(
    "ignored",
  );
});

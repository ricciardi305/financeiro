import { type AccountInput, validateAccount } from "./accounts";

const checking: AccountInput = { name: " Nubank ", institution: "nubank", type: "checking", initialBalanceCents: 0 };
const card: AccountInput = {
  name: "Cartão",
  institution: "nubank",
  type: "credit_card",
  initialBalanceCents: 0,
  closingDay: 25,
  dueDay: 5,
  paymentAccountId: "acc1",
};

test("trims the name and accepts a negative initial balance", () => {
  expect(validateAccount({ ...checking, initialBalanceCents: -1500 })).toMatchObject({
    name: "Nubank",
    initialBalanceCents: -1500,
  });
});

test("rejects blank name and non-integer balance", () => {
  expect(() => validateAccount({ ...checking, name: "  " })).toThrow();
  expect(() => validateAccount({ ...checking, initialBalanceCents: 1.5 })).toThrow();
});

test("card needs valid days and a payment account", () => {
  expect(validateAccount(card).closingDay).toBe(25);
  expect(() => validateAccount({ ...card, closingDay: 0 })).toThrow();
  expect(() => validateAccount({ ...card, dueDay: 32 })).toThrow();
  expect(() => validateAccount({ ...card, paymentAccountId: undefined })).toThrow();
  expect(() => validateAccount({ ...card, limitCents: -1 })).toThrow();
});

test("non-card accounts cannot carry card fields", () => {
  expect(() => validateAccount({ ...checking, dueDay: 5 })).toThrow();
});

test("blank name gives a friendly Portuguese message", () => {
  expect(() => validateAccount({ ...card, name: "" })).toThrow("Informe o nome da conta.");
});

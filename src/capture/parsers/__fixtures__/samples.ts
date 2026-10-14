// Real notifications captured on the device (2026-10-14), anonymized: names and card/account digits changed.
// Never invent a format here; add new samples exactly as captured. Real texts put a non-breaking space
// (U+00A0) between "R$" and the amount, kept here as  .
export type Sample = { packageName: string; title: string | null; text: string | null; bigText: string | null };

const s = (packageName: string, title: string | null, text: string | null): Sample => ({
  packageName,
  title,
  text,
  bigText: text,
});

export const INTER = "br.com.intermedium";
export const NUBANK = "com.nu.production";
export const MERCADO_PAGO = "com.mercadopago.wallet";

export const samples = {
  interPixReceived: s(INTER, "Pix recebido", "Maria Souza Lima te enviou um Pix de R$\u00a01.234,56 creditado na sua conta final ***1111-1."),
  // The sender may add a message; it is appended after the account final as ".- message".
  interPixReceivedWithMessage: s(
    INTER,
    "Pix recebido",
    "Maria Souza Lima te enviou um Pix de R$ 0,01 creditado na sua conta final ***1111-1.- Teste de notificacao",
  ),
  interCreditPurchase: s(
    INTER,
    "Compra no crédito",
    "Olá, Maria. Você acaba de comprar R$\u00a046,90 em MERCADOLIVRE*MERCADOL. A compra foi no crédito nacional, com o cartão final 1234.",
  ),
  nubankTransferReceived: s(NUBANK, "Transferência recebida", "Recebemos sua transferência de R$\u00a00,01."),
  nubankCreditPurchase: s(
    NUBANK,
    "Compra no crédito aprovada",
    "Compra de R$\u00a0120,09 APROVADA em MLP*Magalu-Multimegami para o cartão com final 5678.",
  ),
  nubankCreditRefund: s(
    NUBANK,
    "Compra no crédito estornada",
    "Você recebeu um estorno referente à compra em MLP*Magalu-Multimegami no cartão com final 5678.",
  ),
  nubankCardVerified: s(
    NUBANK,
    "Cartão verificado",
    "MLP acabou de verificar se o seu cartão com final 5678 está ativo e confirmamos que está tudo certo.",
  ),
  nubankMarketing: s(
    NUBANK,
    "Traga seus dados para o Nubank",
    "Receba limite e crédito mais adequados ao seu perfil e recomendações de produtos personalizadas.",
  ),
  nubankEmptyGroup: s(NUBANK, null, null),
  mercadoPagoDeposit: s(
    MERCADO_PAGO,
    "Seu dinheiro já está disponível",
    "Você depositou R$\u00a00,01 via Pix e o valor já está rendendo na sua conta.",
  ),
  mercadoPagoMarketing: s(
    MERCADO_PAGO,
    "Faça seu dinheiro render mais",
    "Conecte sua conta Nubank e deposite para render até 120% do CDI.",
  ),
  // Has money in it but no known layout: must surface as unrecognized, not be silently dropped.
  interUnknownWithMoney: s(INTER, "Pix enviado", "Você enviou um Pix de R$\u00a010,00 para alguém."),
};

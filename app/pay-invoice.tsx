import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isoDateToBr, noonInSaoPaulo, parseBrDate } from "@/domain/dates";
import { errorMessage, UserError } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import { formatCents } from "@/domain/money";
import { getAccount } from "@/services/accounts";
import { getInvoiceDetail, payInvoice } from "@/services/invoices";
import { DateField } from "@/ui/DateField";
import { Button, Field, FormFooter, MoneyField, Text } from "@/ui/form";
import { invoiceTitle } from "@/ui/invoiceLabels";
import { colors, spacing } from "@/ui/theme";
import { toast } from "@/ui/toast";
import { useKeyboardLift } from "@/ui/useKeyboardLift";

/** Records a payment (all or part) of an invoice, taken from the card payment account. */
export default function PayInvoice() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ref: screenRef, lift } = useKeyboardLift();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inv] = useState(() => getInvoiceDetail(id));
  const [cents, setCents] = useState(0); // starts empty on purpose: typing replaces it instead of appending to the total
  const [date, setDate] = useState(isoDateToBr(saoPauloDate(new Date().toISOString())));
  const payer = inv.card.paymentAccountId ? getAccount(inv.card.paymentAccountId) : undefined;

  const save = () => {
    try {
      const day = parseBrDate(date);
      if (!day) throw new UserError("Data inválida. Use o formato dd/mm/aaaa.");
      if (cents <= 0) throw new UserError("Informe um valor maior que zero.");
      payInvoice({ invoiceId: inv.id, amountCents: cents, occurredAt: noonInSaoPaulo(day) });
      toast("Pagamento registrado");
      router.back();
    } catch (e) {
      Alert.alert("Não foi possível pagar", errorMessage(e));
    }
  };

  return (
    <View ref={screenRef} collapsable={false} style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: lift }}>
      <Stack.Screen options={{ title: "Registrar pagamento" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={{ fontWeight: "600" }}>{invoiceTitle(inv.referenceMonth)}</Text>
          <Text style={{ color: colors.muted }}>
            Falta pagar {formatCents(inv.summary.remainingCents)} de {formatCents(inv.summary.totalCents)}
          </Text>
          <Text style={{ color: colors.muted }}>
            {payer ? `Sai de: ${payer.name}` : "O cartão não tem conta pagadora."}
          </Text>
        </View>
        <MoneyField label="Quanto você pagou?" cents={cents} onChangeCents={setCents} autoFocus />
        <Button
          secondary
          title={`Usar o valor total (${formatCents(inv.summary.remainingCents)})`}
          onPress={() => setCents(inv.summary.remainingCents)}
        />
        <DateField label="Data" value={date} onChange={setDate} />
      </ScrollView>
      <FormFooter bottomInset={lift > 0 ? 0 : insets.bottom}>
        <Button title="Registrar pagamento" onPress={save} />
      </FormFooter>
    </View>
  );
}

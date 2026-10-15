import { useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isoDateToBr, monthLabel, noonInSaoPaulo, parseBrDate } from "@/domain/dates";
import { errorMessage, UserError } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import { getAccount } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import { addInvoiceAdjustment } from "@/services/invoices";
import { DateField } from "@/ui/DateField";
import { Button, Chips, Field, FormFooter, MoneyField, Text } from "@/ui/form";
import { colors, spacing } from "@/ui/theme";
import { toast } from "@/ui/toast";
import { useKeyboardLift } from "@/ui/useKeyboardLift";

type Type = "refund" | "fee";
const TYPES: { value: Type; label: string }[] = [
  { value: "refund", label: "Estorno" },
  { value: "fee", label: "Juros ou encargo" },
];

/** Refund (reduces the invoice) or fee/interest (increases it) on one month's invoice of a card. */
export default function InvoiceAdjustment() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ref: screenRef, lift } = useKeyboardLift();
  const { cardId, month } = useLocalSearchParams<{ cardId: string; month: string }>();
  const card = useMemo(() => getAccount(cardId), [cardId]);
  const categories = useMemo(() => listCategories("expense"), []);
  const [type, setType] = useState<Type>("refund");
  const [cents, setCents] = useState(0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(isoDateToBr(saoPauloDate(new Date().toISOString())));
  const [categoryId, setCategoryId] = useState<string>();

  const save = () => {
    try {
      const day = parseBrDate(date);
      if (!day) throw new UserError("Data inválida. Use o formato dd/mm/aaaa.");
      addInvoiceAdjustment({
        cardAccountId: cardId,
        referenceMonth: month,
        type,
        amountCents: cents,
        description: description.trim() || (type === "refund" ? "Estorno" : "Juros e encargos"),
        occurredAt: noonInSaoPaulo(day),
        categoryId,
      });
      toast(type === "refund" ? "Estorno lançado" : "Encargo lançado");
      router.back();
    } catch (e) {
      Alert.alert("Não foi possível salvar", errorMessage(e));
    }
  };

  return (
    <View ref={screenRef} collapsable={false} style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: lift }}>
      <Stack.Screen options={{ title: "Estorno ou encargo" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: colors.muted }}>
          Fatura de {monthLabel(month)} · {card.name}.{" "}
          {type === "refund" ? "O estorno reduz o total da fatura." : "O encargo aumenta o total da fatura."}
        </Text>
        <Chips label="Tipo" options={TYPES} value={type} onChange={setType} />
        <MoneyField label="Valor" cents={cents} onChangeCents={setCents} autoFocus />
        <Field
          label="Descrição (opcional)"
          value={description}
          onChangeText={setDescription}
          placeholder={type === "refund" ? "Estorno" : "Juros e encargos"}
        />
        <DateField label="Data" value={date} onChange={setDate} />
        <Chips
          label="Categoria (opcional)"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={categoryId}
          onChange={setCategoryId}
          onClear={() => setCategoryId(undefined)}
        />
      </ScrollView>
      <FormFooter bottomInset={lift > 0 ? 0 : insets.bottom}>
        <Button title="Salvar" onPress={save} />
      </FormFooter>
    </View>
  );
}

import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isoDateToBr, maskDate, parseBrDate } from "@/domain/dates";
import { errorMessage, UserError } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import { getAccount } from "@/services/accounts";
import { saveSnapshot } from "@/services/investments";
import { Button, Field, FormFooter, MoneyField, Text } from "@/ui/form";
import { colors, spacing } from "@/ui/theme";
import { toast } from "@/ui/toast";
import { useKeyboardLift } from "@/ui/useKeyboardLift";

/** Types the balance shown by the broker/bank today; the yield since the last snapshot is derived from it. */
export default function InvestmentSnapshot() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ref: screenRef, lift } = useKeyboardLift();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [account] = useState(() => getAccount(id));
  const [cents, setCents] = useState(0);
  const [date, setDate] = useState(isoDateToBr(saoPauloDate(new Date().toISOString())));

  const save = () => {
    try {
      const day = parseBrDate(date);
      if (!day) throw new UserError("Data inválida. Use o formato dd/mm/aaaa.");
      saveSnapshot(id, { date: day, balanceCents: cents });
      toast("Saldo atualizado");
      router.back();
    } catch (e) {
      Alert.alert("Não foi possível salvar", errorMessage(e));
    }
  };

  return (
    <View ref={screenRef} collapsable={false} style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: lift }}>
      <Stack.Screen options={{ title: "Atualizar saldo" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: colors.muted }}>
          {account.name}. Digite o saldo que o banco mostra hoje, já com os rendimentos. Aportes e resgates feitos
          entre uma atualização e outra são descontados do rendimento.
        </Text>
        <MoneyField label="Saldo atual do investimento" cents={cents} onChangeCents={setCents} autoFocus />
        <Field label="Data" value={date} onChangeText={(t) => setDate(maskDate(t))} keyboardType="numeric" />
      </ScrollView>
      <FormFooter bottomInset={lift > 0 ? 0 : insets.bottom}>
        <Button title="Salvar" onPress={save} />
      </FormFooter>
    </View>
  );
}

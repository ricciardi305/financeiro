import { useCallback, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isoDateToBr, monthLabel, noonInSaoPaulo, parseBrDate } from "@/domain/dates";
import { errorMessage, UserError } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import { formatCents } from "@/domain/money";
import {
  getOccurrence,
  markOccurrencePaid,
  type OccurrenceRow,
  reopenOccurrence,
  skipOccurrence,
} from "@/services/recurrences";
import { DateField } from "@/ui/DateField";
import { Button, Field, FormFooter, MoneyField, Text } from "@/ui/form";
import { colors, spacing } from "@/ui/theme";
import { toast } from "@/ui/toast";
import { useKeyboardLift } from "@/ui/useKeyboardLift";

const STATE_TEXT = { planned: "Prevista", late: "Atrasada", paid: "Paga", skipped: "Pulada" } as const;

/** One bill of one month: record the real payment, skip it, or undo. */
export default function OccurrenceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ref: screenRef, lift } = useKeyboardLift();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [occ, setOcc] = useState<OccurrenceRow>();
  const [cents, setCents] = useState(0);
  const [date, setDate] = useState(isoDateToBr(saoPauloDate(new Date().toISOString())));

  useFocusEffect(
    useCallback(() => {
      const o = getOccurrence(id);
      setOcc(o);
      setCents((c) => (c === 0 ? o.expectedCents : c)); // starts at the expected amount; typing replaces it
    }, [id]),
  );
  if (!occ) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const income = occ.kind === "income";
  const actionable = occ.status === "planned";

  const run = (job: () => void, message: string, errorTitle: string) => {
    try {
      job();
      toast(message);
      router.back();
    } catch (e) {
      Alert.alert(errorTitle, errorMessage(e));
    }
  };

  const pay = () =>
    run(
      () => {
        const day = parseBrDate(date);
        if (!day) throw new UserError("Data inválida. Use o formato dd/mm/aaaa.");
        markOccurrencePaid(occ.id, { amountCents: cents, occurredAt: noonInSaoPaulo(day) });
      },
      income ? "Recebimento registrado" : "Pagamento registrado",
      "Não foi possível registrar",
    );

  const undo = () =>
    Alert.alert(
      occ.status === "paid" ? "Desfazer o pagamento?" : "Reativar esta conta?",
      occ.status === "paid" ? "O lançamento será excluído e a conta volta a ficar prevista." : "Ela volta a ficar prevista.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: occ.status === "paid" ? "Desfazer" : "Reativar",
          style: "destructive",
          onPress: () => run(() => reopenOccurrence(occ.id), "Conta reaberta", "Não foi possível desfazer"),
        },
      ],
    );

  return (
    <View ref={screenRef} collapsable={false} style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: lift }}>
      <Stack.Screen options={{ title: occ.description }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={{ color: occ.state === "late" ? colors.expense : colors.muted, fontWeight: "600" }}>
            {STATE_TEXT[occ.state]}
          </Text>
          <Text style={{ fontSize: 32, fontWeight: "700" }}>{formatCents(occ.paidCents ?? occ.expectedCents)}</Text>
          <Text style={{ color: colors.muted }}>
            {monthLabel(occ.month)} · vence {isoDateToBr(occ.dueDate).slice(0, 5)} · {occ.accountName}
          </Text>
          {occ.status === "paid" && occ.paidCents !== occ.expectedCents && (
            <Text style={{ color: colors.muted }}>Previsto: {formatCents(occ.expectedCents)}</Text>
          )}
          {occ.isVariable && <Text style={{ color: colors.muted }}>O valor varia todo mês.</Text>}
        </View>

        {actionable && (
          <>
            <MoneyField
              label={income ? "Quanto você recebeu?" : "Quanto você pagou?"}
              cents={cents}
              onChangeCents={setCents}
              autoFocus={occ.isVariable}
            />
            <DateField label="Data" value={date} onChange={setDate} />
            <Button secondary title="Pular este mês" onPress={() => run(() => skipOccurrence(occ.id), "Conta pulada", "Não foi possível pular")} />
          </>
        )}
        {!actionable && (
          <Button
            danger
            title={occ.status === "paid" ? "Desfazer pagamento" : "Reativar conta"}
            onPress={undo}
          />
        )}
        <Button
          secondary
          title="Editar conta fixa"
          onPress={() => router.push({ pathname: "/recurrence-form", params: { id: occ.recurrenceId } })}
        />
      </ScrollView>
      {actionable && (
        <FormFooter bottomInset={lift > 0 ? 0 : insets.bottom}>
          <Button title={income ? "Marcar como recebida" : "Marcar como paga"} onPress={pay} />
        </FormFooter>
      )}
    </View>
  );
}

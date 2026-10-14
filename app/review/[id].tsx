import { useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isoDateToBr } from "@/domain/dates";
import { errorMessage } from "@/domain/errors";
import { formatCents } from "@/domain/money";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import { confirmCaptured, discardCaptured, getInboxDetail, markAsOwnTransfer } from "@/services/capture";
import { Button, Chips, Field, FormFooter, Text } from "@/ui/form";
import { refreshInbox } from "@/ui/inbox";
import { colors, spacing } from "@/ui/theme";
import { toast } from "@/ui/toast";
import { useKeyboardLift } from "@/ui/useKeyboardLift";

const NECESSITIES = [
  { value: "essential", label: "Obrigatória" },
  { value: "optional", label: "Opcional" },
] as const;

/** Review of one captured transaction: fix the description, categorize, split into installments or discard. */
export default function Review() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ref: screenRef, lift } = useKeyboardLift();
  const { id } = useLocalSearchParams<{ id: string }>();
  const d = useMemo(() => getInboxDetail(id), [id]);
  const isRefund = d.kind === "adjustment";
  const isIncome = d.kind === "income";
  const categories = useMemo(() => (isRefund ? [] : listCategories(isIncome ? "income" : "expense")), [isRefund, isIncome]);
  const sources = useMemo(
    () => listAccounts().filter((a) => a.type !== "credit_card" && a.id !== d.accountId),
    [d.accountId],
  );

  const [description, setDescription] = useState(d.description);
  const [categoryId, setCategoryId] = useState<string | undefined>(d.categoryId ?? undefined);
  const [necessity, setNecessity] = useState<"essential" | "optional" | undefined>(d.necessity ?? undefined);
  const [installments, setInstallments] = useState("1");
  const [sourceId, setSourceId] = useState<string>();

  const pickCategory = (cid: string) => {
    setCategoryId(cid);
    const def = categories.find((c) => c.id === cid)?.defaultNecessity;
    if (def && !necessity) setNecessity(def);
  };

  const done = (message: string) => {
    refreshInbox();
    toast(message);
    router.back();
  };

  const run = (job: () => void, message: string, errorTitle: string) => {
    try {
      job();
      done(message);
    } catch (e) {
      Alert.alert(errorTitle, errorMessage(e));
    }
  };

  const confirm = () =>
    run(
      () =>
        confirmCaptured(id, {
          description,
          categoryId,
          necessity,
          installments: Math.max(1, Math.floor(Number(installments) || 1)),
        }),
      "Lançamento confirmado",
      "Não foi possível confirmar",
    );

  const discard = () =>
    Alert.alert("Descartar este lançamento?", "Ele sai do app. A notificação continua guardada.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Descartar", style: "destructive", onPress: () => run(() => discardCaptured(id), "Descartado", "Não foi possível descartar") },
    ]);

  const asTransfer = () => {
    if (!sourceId) return Alert.alert("Escolha a conta de origem", "De qual das suas contas saiu esse dinheiro?");
    run(() => markAsOwnTransfer(id, sourceId), "Virou transferência", "Não foi possível converter");
  };

  return (
    <View ref={screenRef} collapsable={false} style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: lift }}>
      <Stack.Screen options={{ title: "Revisar lançamento" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.xs }}>
          <Text style={{ fontSize: 28, fontWeight: "700", color: isRefund || isIncome ? colors.income : colors.text }}>
            {formatCents(d.amountCents)}
          </Text>
          <Text style={{ color: colors.muted }}>
            {d.accountName} · {isoDateToBr(d.occurredOn)}
          </Text>
          {d.notificationText && <Text style={{ color: colors.muted }}>"{d.notificationText}"</Text>}
        </View>

        {isRefund ? (
          <Text>Estorno ligado à compra original, na mesma fatura. Confirme se estiver certo.</Text>
        ) : (
          <>
            <Field label="Descrição" value={description} onChangeText={setDescription} />
            <Chips
              label="Categoria"
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              value={categoryId}
              onChange={pickCategory}
              onClear={() => setCategoryId(undefined)}
            />
            {!isIncome && (
              <Chips
                label="Necessidade"
                options={[...NECESSITIES]}
                value={necessity}
                onChange={setNecessity}
                onClear={() => setNecessity(undefined)}
              />
            )}
            {d.isCard && (
              <View style={{ gap: spacing.xs }}>
                <Field
                  label="Parcelas"
                  value={installments}
                  onChangeText={(t) => setInstallments(t.replace(/\D/g, "").slice(0, 2))}
                  keyboardType="numeric"
                />
                <Text style={{ color: colors.muted }}>
                  A notificação mostra o valor total. Com mais de 1 parcela, o app divide entre as faturas.
                </Text>
              </View>
            )}
            {isIncome && sources.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <Chips
                  label="Veio de outra conta minha?"
                  options={sources.map((a) => ({ value: a.id, label: a.name }))}
                  value={sourceId}
                  onChange={setSourceId}
                  onClear={() => setSourceId(undefined)}
                />
                {sourceId && <Button secondary title="É transferência entre minhas contas" onPress={asTransfer} />}
              </View>
            )}
          </>
        )}
        <Button title="Descartar" onPress={discard} danger />
      </ScrollView>
      <FormFooter bottomInset={lift > 0 ? 0 : insets.bottom}>
        <Button title="Confirmar" onPress={confirm} />
      </FormFooter>
    </View>
  );
}

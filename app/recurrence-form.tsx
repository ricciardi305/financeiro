import { useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { monthToBr, parseBrMonth } from "@/domain/dates";
import { errorMessage, UserError } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import { listAccounts } from "@/services/accounts";
import { createRecurrence, getRecurrence, setRecurrenceActive, updateRecurrence } from "@/services/recurrences";
import { CategoryPicker } from "@/ui/CategoryPicker";
import { MonthField } from "@/ui/DateField";
import { Button, Chips, Field, FormFooter, MoneyField, Text } from "@/ui/form";
import { colors, spacing } from "@/ui/theme";
import { toast } from "@/ui/toast";
import { useKeyboardLift } from "@/ui/useKeyboardLift";

type Kind = "income" | "expense";
type Necessity = "essential" | "optional";

const KINDS: { value: Kind; label: string }[] = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
];
const NECESSITIES: { value: Necessity; label: string }[] = [
  { value: "essential", label: "Obrigatória" },
  { value: "optional", label: "Opcional" },
];
const AMOUNT_MODES = [
  { value: "fixed", label: "Valor fixo" },
  { value: "variable", label: "Varia todo mês" },
] as const;

/** Create or edit a recurring bill or income (salary, rent, internet, subscriptions...). */
export default function RecurrenceForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ref: screenRef, lift } = useKeyboardLift();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => (id ? getRecurrence(id) : undefined), [id]);
  const allAccounts = useMemo(() => listAccounts(), []);

  const [kind, setKind] = useState<Kind>(existing?.kind ?? "expense");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [cents, setCents] = useState(existing?.amountCents ?? 0);
  const [variable, setVariable] = useState<"fixed" | "variable">(existing?.isVariableAmount ? "variable" : "fixed");
  const [day, setDay] = useState(existing?.dayOfMonth?.toString() ?? "");
  const [accountId, setAccountId] = useState<string | undefined>(existing?.accountId);
  const [categoryId, setCategoryId] = useState<string | undefined>(existing?.categoryId ?? undefined);
  const [necessity, setNecessity] = useState<Necessity>(existing?.necessity ?? "essential");
  const [start, setStart] = useState(
    monthToBr(existing?.startMonth ?? saoPauloDate(new Date().toISOString()).slice(0, 7)),
  );
  const [end, setEnd] = useState(existing?.endMonth ? monthToBr(existing.endMonth) : "");

  const accountOptions = allAccounts
    .filter((a) => kind === "expense" || a.type !== "credit_card")
    .map((a) => ({ value: a.id, label: a.name }));

  const changeKind = (k: Kind) => {
    setKind(k);
    setCategoryId(undefined);
    if (k === "income" && allAccounts.find((a) => a.id === accountId)?.type === "credit_card") setAccountId(undefined);
  };

  const save = () => {
    try {
      const startMonth = parseBrMonth(start);
      if (!startMonth) throw new UserError("Mês inicial inválido. Use mm/aaaa.");
      const endMonth = end.trim() ? parseBrMonth(end) : undefined;
      if (endMonth === null) throw new UserError("Mês final inválido. Use mm/aaaa.");
      const input = {
        description,
        kind,
        accountId: accountId ?? "",
        categoryId,
        necessity: kind === "expense" ? necessity : undefined,
        amountCents: cents,
        isVariableAmount: variable === "variable",
        dayOfMonth: Number(day),
        startMonth,
        endMonth,
      };
      if (existing) updateRecurrence(existing.id, input);
      else createRecurrence(input);
      toast(existing ? "Conta fixa atualizada" : "Conta fixa criada");
      router.back();
    } catch (e) {
      Alert.alert("Não foi possível salvar", errorMessage(e));
    }
  };

  const toggleActive = () => {
    if (!existing) return;
    const turnOff = existing.active;
    const apply = () => {
      try {
        setRecurrenceActive(existing.id, !turnOff);
        toast(turnOff ? "Conta fixa desativada" : "Conta fixa reativada");
        router.back();
      } catch (e) {
        Alert.alert("Não foi possível alterar", errorMessage(e));
      }
    };
    if (!turnOff) return apply();
    Alert.alert(
      "Desativar esta conta fixa?",
      "As contas ainda não pagas, deste mês em diante, serão removidas. O que já foi pago continua no histórico.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Desativar", style: "destructive", onPress: apply },
      ],
    );
  };

  return (
    <View ref={screenRef} collapsable={false} style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: lift }}>
      <Stack.Screen options={{ title: existing ? "Editar conta fixa" : "Nova conta fixa" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {existing && !existing.active && <Text style={{ color: colors.muted }}>Esta conta fixa está desativada.</Text>}
        <Chips label="Tipo" options={KINDS} value={kind} onChange={changeKind} disabled={!!existing} />
        <Field label="Descrição" value={description} onChangeText={setDescription} autoFocus={!existing} />
        <MoneyField label="Valor previsto" cents={cents} onChangeCents={setCents} />
        <Chips label="O valor" options={[...AMOUNT_MODES]} value={variable} onChange={setVariable} />
        <Field
          label="Dia do mês"
          value={day}
          onChangeText={(t) => setDay(t.replace(/\D/g, "").slice(0, 2))}
          keyboardType="number-pad"
          placeholder="1 a 31"
        />
        <Chips
          label={kind === "income" ? "Cai na conta" : "Paga com"}
          options={accountOptions}
          value={accountId}
          onChange={setAccountId}
        />
        <CategoryPicker
          label="Categoria (opcional)"
          kind={kind}
          value={categoryId}
          onChange={setCategoryId}
          onClear={() => setCategoryId(undefined)}
        />
        {kind === "expense" && (
          <Chips label="Necessidade" options={NECESSITIES} value={necessity} onChange={setNecessity} />
        )}
        <MonthField label="Começa em" value={start} onChange={setStart} />
        <MonthField label="Termina em (opcional)" value={end} onChange={setEnd} placeholder="sem fim" optional />
        {existing && (
          <Button
            danger={existing.active}
            secondary={!existing.active}
            title={existing.active ? "Desativar conta fixa" : "Reativar conta fixa"}
            onPress={toggleActive}
          />
        )}
      </ScrollView>
      <FormFooter bottomInset={lift > 0 ? 0 : insets.bottom}>
        <Button title="Salvar" onPress={save} />
      </FormFooter>
    </View>
  );
}

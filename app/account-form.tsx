import { useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AccountType, Institution } from "@/domain/accounts";
import { errorMessage } from "@/domain/errors";
import { createAccount, getAccount, listAccounts, setArchived, updateAccount } from "@/services/accounts";
import { Button, Chips, Field, FormFooter, MoneyField } from "@/ui/form";
import { INSTITUTION_LABEL, TYPE_LABEL } from "@/ui/labels";
import { colors, spacing } from "@/ui/theme";
import { useKeyboardLift } from "@/ui/useKeyboardLift";
import { toast } from "@/ui/toast";

const opts = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export default function AccountForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ref: screenRef, lift } = useKeyboardLift();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => (id ? getAccount(id) : undefined), [id]);
  const checkings = useMemo(() => listAccounts().filter((a) => a.type === "checking"), []);

  const [name, setName] = useState(existing?.name ?? "");
  const [institution, setInstitution] = useState<Institution>(existing?.institution ?? "nubank");
  const [institutionName, setInstitutionName] = useState(existing?.institutionName ?? "");
  const [type, setType] = useState<AccountType>(existing?.type ?? "checking");
  const [balance, setBalance] = useState(existing?.initialBalanceCents ?? 0);
  const [closingDay, setClosingDay] = useState(existing?.closingDay?.toString() ?? "");
  const [dueDay, setDueDay] = useState(existing?.dueDay?.toString() ?? "");
  const [limit, setLimit] = useState(existing?.limitCents ?? 0);
  const [payerId, setPayerId] = useState<string | undefined>(existing?.paymentAccountId ?? undefined);

  const isCard = type === "credit_card";

  const save = () => {
    try {
      const initialBalanceCents = existing ? existing.initialBalanceCents : balance;
      const limitCents = limit > 0 ? limit : undefined;
      const card = isCard
        ? { closingDay: Number(closingDay), dueDay: Number(dueDay), limitCents, paymentAccountId: payerId }
        : {};
      if (existing) updateAccount(existing.id, { name, institution, institutionName, ...card });
      else createAccount({ name, institution, institutionName, type, initialBalanceCents, ...card });
      toast(existing ? "Conta atualizada" : "Conta salva");
      router.back();
    } catch (e) {
      Alert.alert("Não foi possível salvar", errorMessage(e));
    }
  };

  const toggleArchive = () => {
    if (!existing) return;
    try {
      setArchived(existing.id, !existing.archived);
      toast(existing.archived ? "Conta reativada" : "Conta arquivada");
      router.back();
    } catch (e) {
      Alert.alert("Não foi possível arquivar", errorMessage(e));
    }
  };

  return (
    <View ref={screenRef} collapsable={false} style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: lift }}>
      <Stack.Screen options={{ title: existing ? "Editar conta" : "Nova conta" }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <Field label="Nome" value={name} onChangeText={setName} autoFocus={!existing} />
        <Chips label="Instituição" options={opts(INSTITUTION_LABEL)} value={institution} onChange={setInstitution} />
        {institution === "other" && (
          <Field label="Nome da instituição" value={institutionName} onChangeText={setInstitutionName} />
        )}
        <Chips label="Tipo" options={opts(TYPE_LABEL)} value={type} onChange={setType} disabled={!!existing} />
        <MoneyField
          label="Saldo inicial (fixo após criar)"
          cents={balance}
          onChangeCents={setBalance}
          allowNegative
          editable={!existing}
        />
        {isCard && (
          <>
            <Field label="Dia de fechamento" value={closingDay} onChangeText={setClosingDay} keyboardType="numeric" />
            <Field label="Dia de vencimento" value={dueDay} onChangeText={setDueDay} keyboardType="numeric" />
            <MoneyField label="Limite (opcional)" cents={limit} onChangeCents={setLimit} />
            <Chips
              label="Conta que paga a fatura"
              options={checkings.map((a) => ({ value: a.id, label: a.name }))}
              value={payerId}
              onChange={setPayerId}
            />
          </>
        )}
        {existing && (
          <Button title={existing.archived ? "Reativar conta" : "Arquivar conta"} onPress={toggleArchive} danger />
        )}
      </ScrollView>
      <FormFooter bottomInset={lift > 0 ? 0 : insets.bottom}>
        <Button title="Salvar" onPress={save} />
      </FormFooter>
    </View>
  );
}

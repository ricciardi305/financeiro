import { useMemo, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AccountType, Institution } from "@/domain/accounts";
import { errorMessage } from "@/domain/errors";
import { createAccount, getAccount, listAccounts, setArchived, updateAccount } from "@/services/accounts";
import { Button, Chips, Field, MoneyField } from "@/ui/form";
import { INSTITUTION_LABEL, TYPE_LABEL } from "@/ui/labels";
import { colors } from "@/ui/theme";

const opts = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export default function AccountForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => (id ? getAccount(id) : undefined), [id]);
  const checkings = useMemo(() => listAccounts().filter((a) => a.type === "checking"), []);

  const [name, setName] = useState(existing?.name ?? "");
  const [institution, setInstitution] = useState<Institution>(existing?.institution ?? "nubank");
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
      if (existing) updateAccount(existing.id, { name, institution, ...card });
      else createAccount({ name, institution, type, initialBalanceCents, ...card });
      router.back();
    } catch (e) {
      Alert.alert("Não foi possível salvar", errorMessage(e));
    }
  };

  const toggleArchive = () => {
    if (!existing) return;
    try {
      setArchived(existing.id, !existing.archived);
      router.back();
    } catch (e) {
      Alert.alert("Não foi possível arquivar", errorMessage(e));
    }
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 16 + insets.bottom, gap: 16 }}>
      <Stack.Screen options={{ title: existing ? "Editar conta" : "Nova conta" }} />
      <Field label="Nome" value={name} onChangeText={setName} />
      <Chips label="Instituição" options={opts(INSTITUTION_LABEL)} value={institution} onChange={setInstitution} />
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
      <Button title="Salvar" onPress={save} />
      {existing && (
        <Button title={existing.archived ? "Reativar conta" : "Arquivar conta"} onPress={toggleArchive} danger />
      )}
    </ScrollView>
  );
}

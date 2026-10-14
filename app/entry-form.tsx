import { useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isoDateToBr, maskDate, noonInSaoPaulo, parseBrDate } from "@/domain/dates";
import { errorMessage, UserError } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import {
  createEntry,
  createTransfer,
  deleteTransaction,
  getTransactionForEdit,
  updateEntry,
  updateTransfer,
} from "@/services/transactions";
import { Button, Chips, Field, FormFooter, MoneyField, Text } from "@/ui/form";
import { colors, spacing } from "@/ui/theme";
import { useKeyboardLift } from "@/ui/useKeyboardLift";
import { toast } from "@/ui/toast";

type Kind = "expense" | "income" | "transfer";
type Necessity = "essential" | "optional";

const KINDS: { value: Kind; label: string }[] = [
  { value: "expense", label: "Despesa" },
  { value: "income", label: "Receita" },
  { value: "transfer", label: "Transferência" },
];
const NECESSITIES: { value: Necessity; label: string }[] = [
  { value: "essential", label: "Obrigatória" },
  { value: "optional", label: "Opcional" },
];

/** Create (no `id` param) or edit (`id` of any leg) a transaction. */
export default function EntryForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ref: screenRef, lift } = useKeyboardLift();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useMemo(() => (id ? getTransactionForEdit(id) : undefined), [id]);

  // Card purchases need an invoice (phase 2), so cards are not selectable yet.
  const accounts = useMemo(() => listAccounts().filter((a) => a.type !== "credit_card"), []);
  const accountOptions = accounts.map((a) => ({ value: a.id, label: a.name }));

  const [kind, setKind] = useState<Kind>(existing?.kind ?? "expense");
  const [cents, setCents] = useState(existing?.amountCents ?? 0);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [date, setDate] = useState(isoDateToBr(existing?.occurredOn ?? saoPauloDate(new Date().toISOString())));
  const [accountId, setAccountId] = useState<string | undefined>(
    existing?.accountId ?? (accounts.length === 1 ? accounts[0].id : undefined),
  );
  const [toAccountId, setToAccountId] = useState<string | undefined>(existing?.toAccountId);
  const [categoryId, setCategoryId] = useState<string | undefined>(existing?.categoryId ?? undefined);
  const [necessity, setNecessity] = useState<Necessity | undefined>(existing?.necessity ?? undefined);

  const categories = useMemo(() => (kind === "transfer" ? [] : listCategories(kind)), [kind]);
  const accountName = (accId?: string) => accounts.find((a) => a.id === accId)?.name;

  const changeKind = (k: Kind) => {
    setKind(k);
    setCategoryId(undefined);
    setNecessity(undefined);
  };

  const pickCategory = (cid: string) => {
    setCategoryId(cid);
    const def = categories.find((c) => c.id === cid)?.defaultNecessity;
    if (def) setNecessity(def);
  };

  const save = () => {
    try {
      const day = parseBrDate(date);
      if (!day) throw new UserError("Data inválida. Use o formato dd/mm/aaaa.");
      // Keep the original time of day when the date was not touched.
      const occurredAt = existing && day === existing.occurredOn ? existing.occurredAt : noonInSaoPaulo(day);

      if (existing) {
        if (existing.kind === "transfer") {
          updateTransfer(existing.id, { amountCents: cents, description, occurredAt });
        } else {
          if (!accountId) throw new UserError("Escolha a conta.");
          updateEntry(existing.id, {
            accountId,
            amountCents: cents,
            description,
            occurredAt,
            categoryId: categoryId ?? null,
            necessity: necessity ?? null,
          });
        }
      } else if (kind === "transfer") {
        if (!accountId) throw new UserError("Escolha a conta de origem.");
        if (!toAccountId) throw new UserError("Escolha a conta de destino.");
        createTransfer({ fromAccountId: accountId, toAccountId, amountCents: cents, description, occurredAt });
      } else {
        if (!accountId) throw new UserError("Escolha a conta.");
        createEntry({
          accountId,
          kind,
          amountCents: cents,
          description,
          occurredAt,
          categoryId,
          necessity: kind === "expense" ? necessity : undefined,
        });
      }
      toast(existing ? "Lançamento atualizado" : "Lançamento salvo");
      router.back();
    } catch (e) {
      Alert.alert("Não foi possível salvar", errorMessage(e));
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(
      "Excluir lançamento?",
      existing.kind === "transfer" ? "As duas pontas da transferência serão excluídas." : `"${existing.description}"`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            try {
              deleteTransaction(existing.id);
              toast("Lançamento excluído");
              router.back();
            } catch (e) {
              Alert.alert("Não foi possível excluir", errorMessage(e));
            }
          },
        },
      ],
    );
  };

  const isTransfer = kind === "transfer";

  return (
    <View ref={screenRef} collapsable={false} style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: lift }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
      <Stack.Screen options={{ title: existing ? "Editar lançamento" : "Novo lançamento" }} />
      {accounts.length === 0 && <Text>Crie uma conta (corrente, carteira ou investimento) antes de lançar.</Text>}
      <Chips label="Tipo" options={KINDS} value={kind} onChange={changeKind} disabled={!!existing} />
      <MoneyField label="Valor" cents={cents} onChangeCents={setCents} autoFocus={!existing} />
      <Field label="Descrição" value={description} onChangeText={setDescription} />
      <Field
        label="Data"
        value={date}
        onChangeText={(t) => setDate(maskDate(t))}
        keyboardType="numeric"
        placeholder="dd/mm/aaaa"
      />
      {existing && isTransfer ? (
        <Text style={{ color: colors.muted }}>
          {accountName(accountId)} → {accountName(toAccountId)}. Para trocar as contas, exclua e crie a transferência de novo.
        </Text>
      ) : (
        <>
          <Chips label={isTransfer ? "Conta de origem" : "Conta"} options={accountOptions} value={accountId} onChange={setAccountId} />
          {isTransfer && (
            <Chips
              label="Conta de destino"
              options={accountOptions.filter((o) => o.value !== accountId)}
              value={toAccountId}
              onChange={setToAccountId}
            />
          )}
        </>
      )}
      {!isTransfer && (
        <Chips
          label="Categoria (opcional)"
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
          value={categoryId}
          onChange={pickCategory}
          onClear={() => setCategoryId(undefined)}
        />
      )}
      {kind === "expense" && (
        <Chips
          label="Necessidade (opcional)"
          options={NECESSITIES}
          value={necessity}
          onChange={setNecessity}
          onClear={() => setNecessity(undefined)}
        />
      )}
      {existing && <Button title="Excluir lançamento" onPress={remove} danger />}
      </ScrollView>
      <FormFooter bottomInset={lift > 0 ? 0 : insets.bottom}>
        <Button title="Salvar" onPress={save} />
      </FormFooter>
    </View>
  );
}

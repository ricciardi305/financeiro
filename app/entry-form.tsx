import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isoDateToBr, maskDate, monthLabel, noonInSaoPaulo, parseBrDate } from "@/domain/dates";
import { errorMessage, UserError } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import { formatCents } from "@/domain/money";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import { createCardPurchase, previewCardPurchase } from "@/services/invoices";
import {
  createEntry,
  createTransfer,
  deleteTransaction,
  getTransactionForEdit,
  updateEntry,
  updateTransfer,
} from "@/services/transactions";
import { Button, Chips, Field, FormFooter, MoneyField, Text } from "@/ui/form";
import { colors, ripple, spacing, TAP } from "@/ui/theme";
import { toast } from "@/ui/toast";
import { useKeyboardLift } from "@/ui/useKeyboardLift";

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

/** Create (no `id` param) or edit (`id` of any leg) a transaction. Card purchases are expenses on a card. */
export default function EntryForm() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { ref: screenRef, lift } = useKeyboardLift();
  const { id, accountId: presetAccountId } = useLocalSearchParams<{ id?: string; accountId?: string }>();
  const existing = useMemo(() => (id ? getTransactionForEdit(id) : undefined), [id]);

  const allAccounts = useMemo(() => listAccounts(), []);
  const accountName = (accId?: string) => allAccounts.find((a) => a.id === accId)?.name;

  const [kind, setKind] = useState<Kind>(existing?.kind ?? "expense");
  const [cents, setCents] = useState(existing?.amountCents ?? 0);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [date, setDate] = useState(isoDateToBr(existing?.occurredOn ?? saoPauloDate(new Date().toISOString())));
  const [accountId, setAccountId] = useState<string | undefined>(
    existing?.accountId ?? presetAccountId ?? (allAccounts.length === 1 ? allAccounts[0].id : undefined),
  );
  const [toAccountId, setToAccountId] = useState<string | undefined>(existing?.toAccountId);
  const [categoryId, setCategoryId] = useState<string | undefined>(existing?.categoryId ?? undefined);
  const [necessity, setNecessity] = useState<Necessity | undefined>(existing?.necessity ?? undefined);
  const [installments, setInstallments] = useState("1");
  const [monthOffset, setMonthOffset] = useState(0);

  // Cards only take expenses; income and transfers use the other accounts.
  const eligible = allAccounts.filter((a) => kind === "expense" || a.type !== "credit_card");
  const accountOptions = eligible.map((a) => ({ value: a.id, label: a.name }));
  const selected = allAccounts.find((a) => a.id === accountId);
  const isCardPurchase = !existing && kind === "expense" && selected?.type === "credit_card";
  const isTransfer = kind === "transfer";
  const lockedInstallment = !!existing?.installmentTotal;
  const cardEdit = !!existing?.invoiceId;

  const categories = useMemo(() => (isTransfer ? [] : listCategories(kind)), [kind, isTransfer]);

  const changeKind = (k: Kind) => {
    setKind(k);
    setCategoryId(undefined);
    setNecessity(undefined);
    if (k !== "expense" && selected?.type === "credit_card") setAccountId(undefined);
  };

  const pickCategory = (cid: string) => {
    setCategoryId(cid);
    const def = categories.find((c) => c.id === cid)?.defaultNecessity;
    if (def) setNecessity(def);
  };

  const count = Math.max(1, Math.floor(Number(installments) || 1));
  const day = parseBrDate(date);
  const preview = useMemo(() => {
    if (!isCardPurchase || !accountId || !day) return null;
    try {
      return previewCardPurchase({
        cardAccountId: accountId,
        totalCents: Math.max(cents, count),
        occurredAt: noonInSaoPaulo(day),
        installments: count,
        monthOffset,
      });
    } catch {
      return null; // e.g. more installments than cents; the save button explains it
    }
  }, [isCardPurchase, accountId, day, cents, count, monthOffset]);

  const save = () => {
    try {
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
      } else if (isTransfer) {
        if (!accountId) throw new UserError("Escolha a conta de origem.");
        if (!toAccountId) throw new UserError("Escolha a conta de destino.");
        createTransfer({ fromAccountId: accountId, toAccountId, amountCents: cents, description, occurredAt });
      } else if (isCardPurchase) {
        if (!accountId) throw new UserError("Escolha o cartão.");
        if (!description.trim()) throw new UserError("Informe uma descrição.");
        if (cents <= 0) throw new UserError("Informe um valor maior que zero.");
        createCardPurchase({
          cardAccountId: accountId,
          totalCents: cents,
          description,
          occurredAt,
          installments: count,
          monthOffset,
          categoryId,
          necessity,
        });
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
      toast(existing ? "Lançamento atualizado" : isCardPurchase && count > 1 ? `${count} parcelas lançadas` : "Lançamento salvo");
      router.back();
    } catch (e) {
      Alert.alert("Não foi possível salvar", errorMessage(e));
    }
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(
      "Excluir lançamento?",
      existing.kind === "transfer"
        ? "As duas pontas da transferência serão excluídas."
        : lockedInstallment
          ? `Só esta parcela (${existing.installmentNumber}/${existing.installmentTotal}) será excluída. As outras ficam.`
          : `"${existing.description}"`,
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

  const offsetArrow = (symbol: string, delta: number) => (
    <Pressable
      onPress={() => setMonthOffset((o) => o + delta)}
      android_ripple={{ ...ripple, borderless: true }}
      style={{ width: TAP, height: TAP, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 28, color: colors.primary }}>{symbol}</Text>
    </Pressable>
  );

  return (
    <View ref={screenRef} collapsable={false} style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: lift }}>
      <Stack.Screen
        options={{ title: existing ? "Editar lançamento" : isCardPurchase ? "Compra no cartão" : "Novo lançamento" }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {allAccounts.length === 0 && <Text>Crie uma conta antes de lançar.</Text>}
        {lockedInstallment && (
          <Text style={{ color: colors.muted }}>
            Parcela {existing?.installmentNumber}/{existing?.installmentTotal} de uma compra parcelada: não dá para
            editar. Para corrigir, exclua a parcela e lance de novo.
          </Text>
        )}
        <Chips label="Tipo" options={KINDS} value={kind} onChange={changeKind} disabled={!!existing} />
        <MoneyField
          label={isCardPurchase ? "Valor total da compra" : "Valor"}
          cents={cents}
          onChangeCents={setCents}
          autoFocus={!existing}
          editable={!lockedInstallment}
        />
        <Field
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          editable={!lockedInstallment}
        />
        <Field
          label="Data"
          value={date}
          onChangeText={(t) => setDate(maskDate(t))}
          keyboardType="numeric"
          placeholder="dd/mm/aaaa"
          editable={!lockedInstallment && !cardEdit}
        />

        {existing && isTransfer ? (
          <Text style={{ color: colors.muted }}>
            {accountName(accountId)} → {accountName(toAccountId)}. Para trocar as contas, exclua e crie a transferência
            de novo.
          </Text>
        ) : cardEdit ? (
          <Text style={{ color: colors.muted }}>
            Compra no cartão {accountName(accountId)}. A conta e a data não mudam; para isso, exclua e lance de novo.
          </Text>
        ) : (
          <>
            <Chips
              label={isTransfer ? "Conta de origem" : "Conta ou cartão"}
              options={accountOptions}
              value={accountId}
              onChange={setAccountId}
            />
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

        {isCardPurchase && (
          <View style={{ gap: spacing.md }}>
            <Field
              label="Parcelas"
              value={installments}
              onChangeText={(t) => setInstallments(t.replace(/\D/g, "").slice(0, 2))}
              keyboardType="numeric"
            />
            {preview && (
              <View
                style={{
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: spacing.sm,
                  gap: spacing.xs,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  {offsetArrow("‹", -1)}
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={{ fontWeight: "600" }}>Fatura de {monthLabel(preview[0].referenceMonth)}</Text>
                    <Text style={{ color: colors.muted }}>vence em {isoDateToBr(preview[0].dueDate).slice(0, 5)}</Text>
                  </View>
                  {offsetArrow("›", 1)}
                </View>
                {count > 1 && cents > 0 && (
                  <Text style={{ color: colors.muted, textAlign: "center" }}>
                    {count}x de {formatCents(preview[1]?.amountCents ?? preview[0].amountCents)}
                    {preview[0].amountCents !== preview[1]?.amountCents
                      ? ` (a primeira de ${formatCents(preview[0].amountCents)})`
                      : ""}
                    {" · até "}
                    {monthLabel(preview[preview.length - 1].referenceMonth)}
                  </Text>
                )}
                {monthOffset !== 0 && (
                  <Text style={{ color: colors.muted, textAlign: "center" }}>Fatura ajustada à mão.</Text>
                )}
              </View>
            )}
          </View>
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
      {!lockedInstallment && (
        <FormFooter bottomInset={lift > 0 ? 0 : insets.bottom}>
          <Button title="Salvar" onPress={save} />
        </FormFooter>
      )}
    </View>
  );
}

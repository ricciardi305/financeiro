import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { monthLabel, shiftMonth } from "@/domain/dates";
import { errorMessage } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import { formatCents } from "@/domain/money";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import { deleteTransaction, listTransactions, type TransactionRow } from "@/services/transactions";
import { Button, Chips, Text } from "@/ui/form";
import { colors } from "@/ui/theme";

const ALL = "";

export default function Transactions() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(() => saoPauloDate(new Date().toISOString()).slice(0, 7));
  const [accountId, setAccountId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [version, setVersion] = useState(0);

  const accountOptions = useMemo(
    () => [{ value: ALL, label: "Todas" }, ...listAccounts({ includeArchived: true }).map((a) => ({ value: a.id, label: a.name }))],
    [],
  );
  const categoryOptions = useMemo(
    () => [{ value: ALL, label: "Todas" }, ...listCategories().map((c) => ({ value: c.id, label: c.name }))],
    [],
  );

  useFocusEffect(
    useCallback(() => {
      setRows(
        listTransactions({ month, accountId: accountId || undefined, categoryId: categoryId || undefined }),
      );
    }, [month, accountId, categoryId, version]),
  );

  const confirmDelete = (t: TransactionRow) =>
    Alert.alert(
      "Excluir lançamento?",
      t.isTransfer ? `"${t.description}" (as duas pontas da transferência serão excluídas).` : `"${t.description}"`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: () => {
            try {
              deleteTransaction(t.id);
              setVersion((v) => v + 1);
            } catch (e) {
              Alert.alert("Não foi possível excluir", errorMessage(e));
            }
          },
        },
      ],
    );

  const amountColor = (t: TransactionRow) =>
    t.isTransfer ? colors.muted : t.amountCents > 0 ? colors.income : colors.expense;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "Lançamentos" }} />
      <FlatList
        data={rows}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 + insets.bottom, gap: 8 }}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={12}>
                <Text style={{ fontSize: 28, color: colors.primary }}>‹</Text>
              </Pressable>
              <Text style={{ fontSize: 18, fontWeight: "600" }}>{monthLabel(month)}</Text>
              <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={12}>
                <Text style={{ fontSize: 28, color: colors.primary }}>›</Text>
              </Pressable>
            </View>
            <Chips label="Conta" options={accountOptions} value={accountId} onChange={setAccountId} />
            <Chips label="Categoria" options={categoryOptions} value={categoryId} onChange={setCategoryId} />
          </View>
        }
        ListEmptyComponent={<Text style={{ color: colors.muted }}>Nenhum lançamento neste filtro.</Text>}
        renderItem={({ item: t }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/entry-form", params: { id: t.id } })}
            onLongPress={() => confirmDelete(t)}
            style={{
              padding: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: 8,
              flexDirection: "row",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600" }}>{t.description}</Text>
              <Text style={{ color: colors.muted }}>
                {t.occurredOn.slice(8, 10)}/{t.occurredOn.slice(5, 7)} · {t.accountName} ·{" "}
                {t.isTransfer ? "Transferência" : (t.categoryName ?? "Sem categoria")}
                {t.status === "pending" ? " · pendente" : ""}
              </Text>
            </View>
            <Text style={{ color: amountColor(t), fontWeight: "600" }}>{formatCents(t.amountCents)}</Text>
          </Pressable>
        )}
        ListFooterComponent={
          <View style={{ gap: 8, marginTop: 8 }}>
            {rows.length > 0 && (
              <Text style={{ color: colors.muted, textAlign: "center" }}>Toque para editar, segure para excluir.</Text>
            )}
            <Button title="Novo lançamento" onPress={() => router.push("/entry-form")} />
          </View>
        }
      />
    </View>
  );
}

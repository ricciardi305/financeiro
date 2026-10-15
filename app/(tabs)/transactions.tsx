import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, SectionList, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { monthLabel, shiftMonth } from "@/domain/dates";
import { errorMessage } from "@/domain/errors";
import { saoPauloDate } from "@/domain/entries";
import { formatCents } from "@/domain/money";
import { listAccounts } from "@/services/accounts";
import { listCategories } from "@/services/categories";
import { deleteTransaction, listTransactions, type TransactionRow } from "@/services/transactions";
import { FilterSheet } from "@/ui/FilterSheet";
import { Card, EmptyState, Eyebrow, IconBadge, Text } from "@/ui/form";
import { colors, RADIUS, ripple, spacing, TAP } from "@/ui/theme";
import { toast } from "@/ui/toast";

const ALL = "";

const dayLabel = (day: string, today: string): string => {
  if (day === today) return "Hoje";
  const d = new Date(`${day}T12:00:00Z`);
  if (day === new Date(new Date(`${today}T12:00:00Z`).getTime() - 864e5).toISOString().slice(0, 10)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
};

export default function Transactions() {
  const router = useRouter();
  const [month, setMonth] = useState(() => saoPauloDate(new Date().toISOString()).slice(0, 7));
  const [accountId, setAccountId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      setRows(listTransactions({ month, accountId: accountId || undefined, categoryId: categoryId || undefined }));
    }, [month, accountId, categoryId, version]),
  );

  const today = saoPauloDate(new Date().toISOString());
  const sections = useMemo(() => {
    const byDay = new Map<string, TransactionRow[]>();
    for (const r of rows) byDay.set(r.occurredOn, [...(byDay.get(r.occurredOn) ?? []), r]);
    return [...byDay].map(([day, data]) => ({ title: dayLabel(day, today), data }));
  }, [rows, today]);
  const incomeCents = rows.filter((r) => r.kind === "income").reduce((n, r) => n + r.amountCents, 0);
  const expenseCents = rows.filter((r) => r.kind === "expense").reduce((n, r) => n + r.amountCents, 0);

  const activeFilters = [accountId, categoryId].filter((f) => f !== ALL).length;
  const filterSummary = activeFilters
    ? [
        accountOptions.find((o) => o.value === accountId && o.value !== ALL)?.label,
        categoryOptions.find((o) => o.value === categoryId && o.value !== ALL)?.label,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Todas as contas e categorias";

  const clearFilters = () => {
    setAccountId(ALL);
    setCategoryId(ALL);
  };

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
              toast("Lançamento excluído");
            } catch (e) {
              Alert.alert("Não foi possível excluir", errorMessage(e));
            }
          },
        },
      ],
    );

  const amountColor = (t: TransactionRow) =>
    t.isTransfer ? colors.muted : t.amountCents > 0 ? colors.income : colors.expense;

  const arrow = (symbol: string, delta: number) => (
    <Pressable
      onPress={() => setMonth(shiftMonth(month, delta))}
      android_ripple={{ ...ripple, borderless: true }}
      style={{ width: TAP, height: TAP, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 28, color: colors.primary }}>{symbol}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SectionList
        sections={sections}
        stickySectionHeadersEnabled={false}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              {arrow("‹", -1)}
              <Text style={{ fontSize: 18, fontWeight: "600" }}>{monthLabel(month)}</Text>
              {arrow("›", 1)}
            </View>
            <Pressable
              onPress={() => setFiltersOpen(true)}
              android_ripple={ripple}
              style={{
                minHeight: TAP,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: spacing.md,
                paddingHorizontal: spacing.lg,
                borderWidth: 1,
                borderColor: activeFilters ? colors.primary : colors.border,
                backgroundColor: colors.surface,
                borderRadius: spacing.sm,
                overflow: "hidden",
              }}
            >
              <Text style={{ flex: 1, color: activeFilters ? colors.text : colors.muted }} numberOfLines={1}>
                {filterSummary}
              </Text>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Filtros</Text>
            </Pressable>
            {rows.length > 0 && (
              <Card style={{ flexDirection: "row", gap: spacing.lg }}>
                <View style={{ flex: 1 }}>
                  <Eyebrow>Receitas</Eyebrow>
                  <Text style={{ color: colors.income, fontWeight: "700", fontSize: 17 }}>{formatCents(incomeCents)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Eyebrow>Despesas</Eyebrow>
                  <Text style={{ color: colors.expense, fontWeight: "700", fontSize: 17 }}>{formatCents(-expenseCents)}</Text>
                </View>
              </Card>
            )}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: spacing.sm }}>{section.title}</Text>
        )}
        ListEmptyComponent={
          <EmptyState
            message={activeFilters ? "Nenhum lançamento neste filtro." : "Nenhum lançamento neste mês."}
            actionTitle="Novo lançamento"
            onAction={() => router.push("/entry-form")}
          />
        }
        renderItem={({ item: t }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/entry-form", params: { id: t.id } })}
            onLongPress={() => confirmDelete(t)}
            android_ripple={ripple}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: RADIUS,
              overflow: "hidden",
            }}
          >
            <IconBadge
              icon={t.isTransfer ? "repeat" : (t.categoryIcon ?? "help-circle")}
              color={t.isTransfer ? colors.muted : (t.categoryColor ?? colors.muted)}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600" }} numberOfLines={1}>{t.description}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>
                {t.accountName} · {t.isTransfer ? "Transferência" : (t.categoryName ?? "Sem categoria")}
                {t.status === "pending" ? " · pendente" : ""}
              </Text>
            </View>
            <Text style={{ color: amountColor(t), fontWeight: "600" }}>
              {t.amountCents > 0 && !t.isTransfer ? "+" : ""}
              {formatCents(t.amountCents)}
            </Text>
          </Pressable>
        )}
        ListFooterComponent={
          rows.length > 0 ? (
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: spacing.sm }}>
              Toque para editar, segure para excluir.
            </Text>
          ) : null
        }
      />
      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        accountOptions={accountOptions}
        categoryOptions={categoryOptions}
        accountId={accountId}
        categoryId={categoryId}
        onAccount={setAccountId}
        onCategory={setCategoryId}
        onClear={clearFilters}
      />
    </View>
  );
}

import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { isoDateToBr, monthLabel, shiftMonth } from "@/domain/dates";
import { saoPauloDate } from "@/domain/entries";
import { formatCents } from "@/domain/money";
import { totalsForKind } from "@/domain/recurrences";
import { ensureOccurrence, listMonthOccurrences, type OccurrenceRow } from "@/services/recurrences";
import { Button, EmptyState, Text } from "@/ui/form";
import { colors, ripple, spacing, TAP } from "@/ui/theme";

const STATE_LABEL = { planned: "Prevista", late: "Atrasada", paid: "Paga", skipped: "Pulada" } as const;

function stateColor(state: OccurrenceRow["state"]): string {
  if (state === "late") return colors.expense;
  if (state === "paid") return colors.income;
  return colors.muted;
}

/** Recurring bills and income of one month: what is expected, what was paid, what is late. */
export default function MonthScreen() {
  const router = useRouter();
  const [month, setMonth] = useState(() => saoPauloDate(new Date().toISOString()).slice(0, 7));
  const [items, setItems] = useState<OccurrenceRow[]>([]);

  useFocusEffect(useCallback(() => setItems(listMonthOccurrences(month)), [month]));

  const asItems = items.map((i) => ({
    kind: i.kind,
    state: i.state,
    expectedCents: i.expectedCents,
    paidCents: i.paidCents,
  }));
  const expense = totalsForKind(asItems, "expense");
  const income = totalsForKind(asItems, "income");

  const arrow = (symbol: string, delta: number) => (
    <Pressable
      onPress={() => setMonth((m) => shiftMonth(m, delta))}
      android_ripple={{ ...ripple, borderless: true }}
      style={{ width: TAP, height: TAP, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 28, color: colors.primary }}>{symbol}</Text>
    </Pressable>
  );

  const row = (o: OccurrenceRow) => (
    <Pressable
      key={o.id}
      onPress={() =>
        router.push({
          pathname: "/occurrence/[id]",
          // A projected month is stored the moment you open it.
          params: { id: o.virtual ? ensureOccurrence(o.recurrenceId, o.month) : o.id },
        })
      }
      android_ripple={ripple}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: spacing.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: o.state === "late" ? colors.expense : colors.border,
        backgroundColor: colors.surface,
        borderRadius: spacing.sm,
        overflow: "hidden",
        opacity: o.state === "skipped" ? 0.55 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "600", textDecorationLine: o.state === "skipped" ? "line-through" : "none" }}>
          {o.description}
        </Text>
        <Text style={{ color: colors.muted }}>
          {o.state === "paid" ? "paga" : `vence ${isoDateToBr(o.dueDate).slice(0, 5)}`} · {o.accountName}
          {o.isVariable ? " · varia" : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontWeight: "600" }}>{formatCents(o.paidCents ?? o.expectedCents)}</Text>
        <Text style={{ color: stateColor(o.state) }}>{STATE_LABEL[o.state]}</Text>
      </View>
    </Pressable>
  );

  const group = (title: string, list: OccurrenceRow[]) =>
    list.length === 0 ? null : (
      <View style={{ gap: spacing.sm }}>
        <Text style={{ fontWeight: "600" }}>{title}</Text>
        {list.map(row)}
      </View>
    );

  const incomes = items.filter((i) => i.kind === "income");
  const essential = items.filter((i) => i.kind === "expense" && i.necessity === "essential");
  const optional = items.filter((i) => i.kind === "expense" && i.necessity !== "essential");

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {arrow("‹", -1)}
          <Text style={{ fontSize: 18, fontWeight: "600" }}>{monthLabel(month)}</Text>
          {arrow("›", 1)}
        </View>

        {items.length === 0 ? (
          <EmptyState
            message="Nenhuma conta fixa neste mês."
            actionTitle="Criar conta fixa"
            onAction={() => router.push("/recurrence-form")}
          />
        ) : (
          <>
            <View
              style={{
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                borderRadius: spacing.sm,
                gap: spacing.xs,
              }}
            >
              <Text style={{ color: colors.muted }}>Falta pagar</Text>
              <Text style={{ fontSize: 32, fontWeight: "700" }}>{formatCents(expense.pendingCents)}</Text>
              <Text style={{ color: colors.muted }}>
                Pago {formatCents(expense.paidCents)} de {formatCents(expense.expectedCents)} previstos
              </Text>
              {income.expectedCents > 0 && (
                <Text style={{ color: colors.muted }}>
                  Receitas: {formatCents(income.paidCents)} recebidas
                  {income.pendingCents > 0 ? ` · ${formatCents(income.pendingCents)} a receber` : ""}
                </Text>
              )}
            </View>
            {group("Receitas", incomes)}
            {group("Despesas obrigatórias", essential)}
            {group("Despesas opcionais", optional)}
          </>
        )}

        <Button secondary title="Gerenciar contas fixas" onPress={() => router.push("/recurrences")} />
      </ScrollView>
    </View>
  );
}

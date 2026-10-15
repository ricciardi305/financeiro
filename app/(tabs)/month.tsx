import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { isoDateToBr, monthLabel, shiftMonth } from "@/domain/dates";
import { saoPauloDate } from "@/domain/entries";
import { formatCents } from "@/domain/money";
import { totalsForKind } from "@/domain/recurrences";
import { getMonthOverview, type MonthOverview } from "@/services/overview";
import { ensureOccurrence, listMonthOccurrences, type OccurrenceRow } from "@/services/recurrences";
import { BigNumber, Button, Card, EmptyState, Eyebrow, Pill, ProgressBar, Text } from "@/ui/form";
import { colors, RADIUS, ripple, spacing, TAP } from "@/ui/theme";

const line = (label: string, value: string, color: string = colors.text) => (
  <View key={label} style={{ flexDirection: "row", justifyContent: "space-between" }}>
    <Text style={{ color: colors.muted }}>{label}</Text>
    <Text style={{ color }}>{value}</Text>
  </View>
);

/** Realized income and spending, where the money went, and (current month) the projected end balance. */
function Overview({ o }: { o: MonthOverview }) {
  const { spending: s } = o;
  const max = s.byCategory[0]?.cents ?? 0;
  return (
    <>
      <Card hero>
        {o.projectedEndCents !== null && (
          <>
            <Eyebrow>Saldo previsto no fim do mês</Eyebrow>
            <BigNumber cents={o.projectedEndCents} />
            <Text style={{ color: colors.muted, fontSize: 13, marginBottom: spacing.sm }}>
              Saldo atual + receitas e contas fixas que faltam − faturas a vencer.
            </Text>
          </>
        )}
        {line("Receitas recebidas", formatCents(o.incomeCents), colors.income)}
        {line("Despesas do mês", formatCents(s.totalCents), colors.expense)}
        {o.projectedEndCents !== null && line("Contas fixas a pagar", formatCents(o.pendingExpenseCents))}
        {o.projectedEndCents !== null && o.pendingIncomeCents > 0 && line("Receitas a receber", formatCents(o.pendingIncomeCents))}
      </Card>

      {o.dueInvoices.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "600" }}>Faturas a pagar</Text>
          {o.dueInvoices.map((i) =>
            line(`${i.cardName} · vence ${isoDateToBr(i.dueDate).slice(0, 5)}`, formatCents(i.remainingCents)),
          )}
        </Card>
      )}

      {s.byCategory.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "600" }}>Gastos por categoria</Text>
          {s.byCategory.map((c) => (
            <View key={c.name} style={{ gap: 2, marginTop: spacing.xs }}>
              {line(c.name, formatCents(c.cents))}
              <ProgressBar ratio={max > 0 ? Math.max(c.cents, 0) / max : 0} />
            </View>
          ))}
          <View style={{ marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
            {line("Obrigatórias", formatCents(s.byNecessity.essentialCents))}
            {line("Opcionais", formatCents(s.byNecessity.optionalCents))}
            {s.byNecessity.unclassifiedCents !== 0 && line("Sem classificação", formatCents(s.byNecessity.unclassifiedCents))}
          </View>
        </Card>
      )}
    </>
  );
}

const STATE_BG = { planned: colors.neutralBg, late: colors.expenseBg, paid: colors.incomeBg, skipped: colors.neutralBg } as const;

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

  const [overview, setOverview] = useState<MonthOverview>();

  useFocusEffect(
    useCallback(() => {
      setItems(listMonthOccurrences(month));
      setOverview(getMonthOverview(month));
    }, [month]),
  );

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
        backgroundColor: colors.surface,
        borderRadius: RADIUS,
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
      <View style={{ alignItems: "flex-end", gap: spacing.xs }}>
        <Text style={{ fontWeight: "600" }}>{formatCents(o.paidCents ?? o.expectedCents)}</Text>
        <Pill label={STATE_LABEL[o.state]} color={stateColor(o.state)} bg={STATE_BG[o.state]} />
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

        {overview && <Overview o={overview} />}

        {items.length === 0 ? (
          <EmptyState
            message="Nenhuma conta fixa neste mês."
            actionTitle="Criar conta fixa"
            onAction={() => router.push("/recurrence-form")}
          />
        ) : (
          <>
            <Card>
              <Eyebrow>Falta pagar</Eyebrow>
              <BigNumber cents={expense.pendingCents} negativeRed={false} />
              <ProgressBar
                ratio={expense.expectedCents > 0 ? expense.paidCents / expense.expectedCents : 0}
                color={colors.income}
              />
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Pago {formatCents(expense.paidCents)} de {formatCents(expense.expectedCents)} previstos
              </Text>
              {income.expectedCents > 0 && (
                <Text style={{ color: colors.muted, fontSize: 13 }}>
                  Receitas: {formatCents(income.paidCents)} recebidas
                  {income.pendingCents > 0 ? ` · ${formatCents(income.pendingCents)} a receber` : ""}
                </Text>
              )}
            </Card>
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

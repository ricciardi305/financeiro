import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { monthLabel, shiftMonth } from "@/domain/dates";
import { saoPauloDate } from "@/domain/entries";
import { formatCents } from "@/domain/money";
import { NO_CATEGORY, type NetWorth } from "@/domain/overview";
import { listCategories } from "@/services/categories";
import { getMonthOverview, getMonthTotals, getNetWorth, type MonthOverview } from "@/services/overview";
import { listTransactions, type TransactionRow } from "@/services/transactions";
import { BigNumber, Card, EmptyState, Eyebrow, IconBadge, Text } from "@/ui/form";
import { colors, RADIUS, ripple, spacing, TAP } from "@/ui/theme";

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const OTHERS_COLOR = "#64748b";
const TOP_CATEGORIES = 5;
const BAR_AREA = 120;
const MONTHS_SHOWN = 6;

type Totals = { month: string; incomeCents: number; expenseCents: number };

const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
    <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
  </View>
);

/** Income x spending of the last months as paired bars (plain Views: no chart library, no rebuild). */
function MonthlyBars({ series }: { series: Totals[] }) {
  const max = Math.max(1, ...series.flatMap((s) => [s.incomeCents, s.expenseCents]));
  const h = (cents: number) => (cents > 0 ? Math.max(3, Math.round((cents / max) * BAR_AREA)) : 0);
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: BAR_AREA }}>
        {series.map((s) => (
          <View key={s.month} style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 3 }}>
            <View style={{ width: 12, height: h(s.incomeCents), borderRadius: 4, backgroundColor: colors.income }} />
            <View style={{ width: 12, height: h(s.expenseCents), borderRadius: 4, backgroundColor: colors.expense }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row" }}>
        {series.map((s) => (
          <Text key={s.month} style={{ flex: 1, textAlign: "center", color: colors.muted, fontSize: 12 }}>
            {SHORT_MONTHS[Number(s.month.slice(5, 7)) - 1]}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: spacing.lg }}>
        <Legend color={colors.income} label="Receitas" />
        <Legend color={colors.expense} label="Despesas" />
      </View>
    </View>
  );
}

/** Spending split: one stacked bar plus a legend; the top categories and the rest as "Outras". */
function CategorySplit({ o, colorOf }: { o: MonthOverview; colorOf: (name: string) => string }) {
  const positive = o.spending.byCategory.filter((c) => c.cents > 0);
  const total = positive.reduce((s, c) => s + c.cents, 0) || 1;
  const top = positive.slice(0, TOP_CATEGORIES).map((c) => ({ ...c, color: colorOf(c.name) }));
  const restCents = positive.slice(TOP_CATEGORIES).reduce((s, c) => s + c.cents, 0);
  const parts = restCents > 0 ? [...top, { name: "Outras", cents: restCents, color: OTHERS_COLOR }] : top;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", backgroundColor: colors.border }}>
        {parts.map((p) => (
          <View key={p.name} style={{ flex: p.cents / total, backgroundColor: p.color }} />
        ))}
      </View>
      {parts.map((p) => (
        <View key={p.name} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: p.color }} />
          <Text style={{ flex: 1 }}>{p.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>{Math.round((p.cents / total) * 100)}%</Text>
          <Text style={{ fontWeight: "600", minWidth: 96, textAlign: "right" }}>{formatCents(p.cents)}</Text>
        </View>
      ))}
    </View>
  );
}

function Stat(props: { icon: "arrow-down-left" | "arrow-up-right"; color: string; label: string; cents: number }) {
  return (
    <Card style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        <Feather name={props.icon} size={16} color={props.color} />
        <Eyebrow>{props.label}</Eyebrow>
      </View>
      <Text style={{ color: props.color, fontWeight: "700", fontSize: 18 }} numberOfLines={1} adjustsFontSizeToFit>
        {formatCents(props.cents)}
      </Text>
    </Card>
  );
}

/** Home: net worth, the month's income and spending, 6-month trend, spending by category, latest entries. */
export default function Dashboard() {
  const router = useRouter();
  const [month, setMonth] = useState(() => saoPauloDate(new Date().toISOString()).slice(0, 7));
  const [worth, setWorth] = useState<NetWorth>();
  const [overview, setOverview] = useState<MonthOverview>();
  const [series, setSeries] = useState<Totals[]>([]);
  const [recent, setRecent] = useState<TransactionRow[]>([]);
  const [colorByName, setColorByName] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      setWorth(getNetWorth());
      setOverview(getMonthOverview(month));
      setSeries(Array.from({ length: MONTHS_SHOWN }, (_, i) => getMonthTotals(shiftMonth(month, i + 1 - MONTHS_SHOWN))));
      setRecent(listTransactions({ month }).slice(0, 5));
      setColorByName(Object.fromEntries(listCategories().map((c) => [c.name, c.color ?? OTHERS_COLOR])));
    }, [month]),
  );

  const arrow = (symbol: string, delta: number) => (
    <Pressable
      onPress={() => setMonth((m) => shiftMonth(m, delta))}
      android_ripple={{ ...ripple, borderless: true }}
      style={{ width: TAP, height: TAP, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 28, color: colors.primary }}>{symbol}</Text>
    </Pressable>
  );

  if (!worth || !overview) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const resultCents = overview.incomeCents - overview.spending.totalCents;
  const hasSeries = series.some((s) => s.incomeCents > 0 || s.expenseCents > 0);
  const hasSpending = overview.spending.byCategory.some((c) => c.cents > 0);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Card hero>
        <Eyebrow>Saldo total (patrimônio)</Eyebrow>
        <BigNumber cents={worth.netCents} />
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          Contas {formatCents(worth.assetsCents)} − faturas em aberto {formatCents(worth.debtCents)}
        </Text>
        {overview.projectedEndCents !== null && (
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Previsto no fim do mês:{" "}
            <Text style={{ color: overview.projectedEndCents < 0 ? colors.expense : colors.text, fontWeight: "600" }}>
              {formatCents(overview.projectedEndCents)}
            </Text>
          </Text>
        )}
      </Card>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {arrow("‹", -1)}
        <Text style={{ fontSize: 18, fontWeight: "600" }}>{monthLabel(month)}</Text>
        {arrow("›", 1)}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Stat icon="arrow-down-left" color={colors.income} label="Receitas" cents={overview.incomeCents} />
        <Stat icon="arrow-up-right" color={colors.expense} label="Despesas" cents={overview.spending.totalCents} />
      </View>
      <Card>
        <Eyebrow>Resultado do mês</Eyebrow>
        <Text style={{ fontWeight: "700", fontSize: 18, color: resultCents < 0 ? colors.expense : colors.income }}>
          {resultCents > 0 ? "+" : ""}
          {formatCents(resultCents)}
        </Text>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={{ fontWeight: "600" }}>Receitas x despesas</Text>
        {hasSeries ? (
          <MonthlyBars series={series} />
        ) : (
          <Text style={{ color: colors.muted }}>Sem lançamentos nos últimos {MONTHS_SHOWN} meses.</Text>
        )}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={{ fontWeight: "600" }}>Despesas por categoria</Text>
        {hasSpending ? (
          <CategorySplit o={overview} colorOf={(n) => colorByName[n] ?? OTHERS_COLOR} />
        ) : (
          <Text style={{ color: colors.muted }}>Nenhuma despesa neste mês.</Text>
        )}
      </Card>

      {overview.dueInvoices.length > 0 && (
        <Card>
          <Text style={{ fontWeight: "600" }}>Faturas a pagar</Text>
          {overview.dueInvoices.map((i) => (
            <View key={i.id} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.muted }}>
                {i.cardName} · vence {i.dueDate.slice(8, 10)}/{i.dueDate.slice(5, 7)}
              </Text>
              <Text>{formatCents(i.remainingCents)}</Text>
            </View>
          ))}
        </Card>
      )}

      <Card style={{ gap: spacing.sm }}>
        <Text style={{ fontWeight: "600" }}>Últimos lançamentos</Text>
        {recent.length === 0 ? (
          <EmptyState message="Nenhum lançamento neste mês." actionTitle="Novo lançamento" onAction={() => router.push("/entry-form")} />
        ) : (
          recent.map((t) => (
            <Pressable
              key={t.id}
              onPress={() => router.push({ pathname: "/entry-form", params: { id: t.id } })}
              android_ripple={ripple}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, borderRadius: RADIUS, overflow: "hidden" }}
            >
              <IconBadge
                icon={t.isTransfer ? "repeat" : (t.categoryIcon ?? "help-circle")}
                color={t.isTransfer ? colors.muted : (t.categoryColor ?? colors.muted)}
                size={36}
              />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1}>{t.description}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {t.occurredOn.slice(8, 10)}/{t.occurredOn.slice(5, 7)} · {t.isTransfer ? "Transferência" : (t.categoryName ?? NO_CATEGORY)}
                </Text>
              </View>
              <Text style={{ fontWeight: "600", color: t.isTransfer ? colors.muted : t.amountCents > 0 ? colors.income : colors.expense }}>
                {formatCents(t.amountCents)}
              </Text>
            </Pressable>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

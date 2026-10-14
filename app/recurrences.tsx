import { useCallback, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { formatCents } from "@/domain/money";
import { listRecurrences, type Recurrence } from "@/services/recurrences";
import { EmptyState, HeaderAction, Text } from "@/ui/form";
import { colors, ripple, spacing } from "@/ui/theme";

/** All recurring bills and income, including the deactivated ones. */
export default function Recurrences() {
  const router = useRouter();
  const [items, setItems] = useState<(Recurrence & { accountName: string })[]>([]);

  useFocusEffect(useCallback(() => setItems(listRecurrences()), []));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: "Contas fixas",
          headerRight: () => <HeaderAction symbol="+" onPress={() => router.push("/recurrence-form")} />,
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          <EmptyState
            message="Nenhuma conta fixa ainda. Cadastre salário, aluguel, internet, assinaturas..."
            actionTitle="Criar conta fixa"
            onAction={() => router.push("/recurrence-form")}
          />
        }
        renderItem={({ item: r }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/recurrence-form", params: { id: r.id } })}
            android_ripple={ripple}
            style={{
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: spacing.sm,
              overflow: "hidden",
              opacity: r.active ? 1 : 0.5,
              gap: spacing.xs,
            }}
          >
            <Text style={{ fontWeight: "600" }}>
              {r.description}
              {r.active ? "" : " (desativada)"}
            </Text>
            <Text style={{ color: colors.muted }}>
              {r.kind === "income" ? "Receita" : "Despesa"} · dia {r.dayOfMonth} · {r.accountName}
              {r.isVariableAmount ? " · varia" : ""}
            </Text>
            <Text style={{ fontSize: 18, color: r.kind === "income" ? colors.income : colors.text }}>
              {formatCents(r.amountCents)}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

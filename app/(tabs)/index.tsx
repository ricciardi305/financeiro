import { useCallback, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { formatCents } from "@/domain/money";
import { getNetWorth } from "@/services/overview";
import type { NetWorth } from "@/domain/overview";
import { type AccountWithBalance, listAccounts } from "@/services/accounts";
import { EmptyState, Text } from "@/ui/form";
import { institutionLabel, TYPE_LABEL } from "@/ui/labels";
import { colors, ripple, spacing } from "@/ui/theme";

export default function Accounts() {
  const router = useRouter();
  const [items, setItems] = useState<AccountWithBalance[]>([]);
  const [worth, setWorth] = useState<NetWorth>();
  const [showArchived, setShowArchived] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setItems(listAccounts({ includeArchived: showArchived }));
      setWorth(getNetWorth());
    }, [showArchived]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListHeaderComponent={
          worth && items.length > 0 ? (
            <View
              style={{
                padding: spacing.lg,
                marginBottom: spacing.sm,
                borderWidth: 1,
                borderColor: colors.primary,
                backgroundColor: colors.surface,
                borderRadius: spacing.sm,
                gap: spacing.xs,
              }}
            >
              <Text style={{ color: colors.muted }}>Patrimônio</Text>
              <Text style={{ fontSize: 32, fontWeight: "700", color: worth.netCents < 0 ? colors.expense : colors.text }}>
                {formatCents(worth.netCents)}
              </Text>
              <Text style={{ color: colors.muted }}>
                Contas {formatCents(worth.assetsCents)} − faturas em aberto {formatCents(worth.debtCents)}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            message="Nenhuma conta ainda."
            actionTitle="Criar conta"
            onAction={() => router.push("/account-form")}
          />
        }
        renderItem={({ item: a }) => (
          <Pressable
            onPress={() =>
              a.type === "credit_card"
                ? router.push({ pathname: "/card/[id]", params: { id: a.id } })
                : a.type === "investment"
                  ? router.push({ pathname: "/investment/[id]", params: { id: a.id } })
                  : router.push({ pathname: "/account-form", params: { id: a.id } })
            }
            android_ripple={ripple}
            style={{
              padding: spacing.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: spacing.sm,
              overflow: "hidden",
              opacity: a.archived ? 0.5 : 1,
            }}
          >
            <Text style={{ fontWeight: "600" }}>
              {a.name}
              {a.archived ? " (arquivada)" : ""}
            </Text>
            <Text style={{ color: colors.muted }}>
              {TYPE_LABEL[a.type]} · {institutionLabel(a)}
            </Text>
            <Text style={{ fontSize: 18, color: a.balance.confirmedCents < 0 ? colors.expense : colors.text }}>
              {formatCents(a.balance.confirmedCents)}
            </Text>
            {a.balance.pendingCents !== 0 && (
              <Text style={{ color: colors.muted }}>pendente {formatCents(a.balance.pendingCents)}</Text>
            )}
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable
            onPress={() => setShowArchived((v) => !v)}
            style={{ minHeight: 48, justifyContent: "center", marginTop: spacing.sm }}
          >
            <Text style={{ textAlign: "center", color: colors.primary }}>
              {showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
            </Text>
          </Pressable>
        }
      />
    </View>
  );
}

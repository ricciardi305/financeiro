import { useCallback, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { AccountType } from "@/domain/accounts";
import { formatCents } from "@/domain/money";
import { getNetWorth } from "@/services/overview";
import type { NetWorth } from "@/domain/overview";
import { type AccountWithBalance, listAccounts } from "@/services/accounts";
import { BigNumber, Card, EmptyState, Eyebrow, IconBadge, Text } from "@/ui/form";
import { institutionLabel, TYPE_LABEL } from "@/ui/labels";
import { colors, institutionColor, RADIUS, ripple, spacing } from "@/ui/theme";

const TYPE_ICON: Record<AccountType, string> = {
  checking: "dollar-sign",
  credit_card: "credit-card",
  investment: "trending-up",
  cash: "briefcase",
};

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
            <Card hero style={{ marginBottom: spacing.sm }}>
              <Eyebrow>Patrimônio</Eyebrow>
              <BigNumber cents={worth.netCents} />
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                Contas {formatCents(worth.assetsCents)} − faturas em aberto {formatCents(worth.debtCents)}
              </Text>
            </Card>
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
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.lg,
              backgroundColor: colors.surface,
              borderRadius: RADIUS,
              overflow: "hidden",
              opacity: a.archived ? 0.5 : 1,
            }}
          >
            <IconBadge icon={TYPE_ICON[a.type]} color={institutionColor[a.institution] ?? institutionColor.other} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600" }}>
                {a.name}
                {a.archived ? " (arquivada)" : ""}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 13 }}>
                {TYPE_LABEL[a.type]} · {institutionLabel(a)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 17, fontWeight: "600", color: a.balance.confirmedCents < 0 ? colors.expense : colors.text }}>
                {formatCents(a.balance.confirmedCents)}
              </Text>
              {a.balance.pendingCents !== 0 && (
                <Text style={{ color: colors.muted, fontSize: 12 }}>pendente {formatCents(a.balance.pendingCents)}</Text>
              )}
            </View>
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

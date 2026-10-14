import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { isoDateToBr } from "@/domain/dates";
import { formatCents } from "@/domain/money";
import { dismissNotification, listInbox, listProblemNotifications, type InboxItem } from "@/services/capture";
import { EmptyState, Text } from "@/ui/form";
import { syncInbox } from "@/ui/inbox";
import { colors, ripple, spacing } from "@/ui/theme";

const KIND_LABEL = { income: "Entrada", expense: "Compra", adjustment: "Estorno", transfer: "Transferência" } as const;

/** Transactions captured from notifications, waiting to be reviewed, plus notifications that failed. */
export default function Inbox() {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [problems, setProblems] = useState<ReturnType<typeof listProblemNotifications>>([]);

  useFocusEffect(
    useCallback(() => {
      syncInbox();
      setItems(listInbox());
      setProblems(listProblemNotifications());
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
        {items.length === 0 && problems.length === 0 && (
          <EmptyState message="Nada para revisar. As compras e entradas das notificações aparecem aqui." />
        )}

        {items.map((i) => (
          <Pressable
            key={i.id}
            onPress={() => router.push({ pathname: "/review/[id]", params: { id: i.id } })}
            android_ripple={ripple}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              gap: spacing.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              borderRadius: spacing.sm,
              overflow: "hidden",
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600" }}>{i.description}</Text>
              <Text style={{ color: colors.muted }}>
                {KIND_LABEL[i.kind]} · {i.accountName} · {isoDateToBr(i.occurredOn).slice(0, 5)}
                {i.categoryName ? ` · ${i.categoryName}` : " · sem categoria"}
              </Text>
            </View>
            <Text style={{ color: i.amountCents > 0 ? colors.income : colors.text, fontWeight: "600" }}>
              {formatCents(i.amountCents)}
            </Text>
          </Pressable>
        ))}

        {problems.length > 0 && (
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            <Text style={{ fontWeight: "600" }}>Notificações que não viraram lançamento</Text>
            {problems.map((p) => (
              <Pressable
                key={p.id}
                onPress={() =>
                  Alert.alert("Ignorar esta notificação?", "Ela deixa de aparecer aqui e não vira lançamento.", [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Ignorar",
                      onPress: () => {
                        dismissNotification(p.id);
                        setProblems(listProblemNotifications());
                      },
                    },
                  ])
                }
                android_ripple={ripple}
                style={{
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: p.retry ? colors.expense : colors.border,
                  borderRadius: spacing.sm,
                  gap: 2,
                }}
              >
                <Text>{p.text}</Text>
                <Text style={{ color: p.retry ? colors.expense : colors.muted }}>{p.reason}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

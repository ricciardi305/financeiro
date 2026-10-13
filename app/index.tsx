import { useCallback, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatCents } from "@/domain/money";
import { type AccountWithBalance, listAccounts } from "@/services/accounts";
import { Button, Text } from "@/ui/form";
import { colors } from "@/ui/theme";
import { INSTITUTION_LABEL, TYPE_LABEL } from "@/ui/labels";

export default function Accounts() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AccountWithBalance[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setItems(listAccounts({ includeArchived: showArchived }));
    }, [showArchived]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, paddingBottom: 16 + insets.bottom, gap: 12 }}>
      <Stack.Screen options={{ title: "Contas" }} />
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ gap: 8 }}
        ListEmptyComponent={<Text>Nenhuma conta ainda.</Text>}
        renderItem={({ item: a }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/account-form", params: { id: a.id } })}
            style={{ padding: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 8, opacity: a.archived ? 0.5 : 1 }}
          >
            <Text style={{ fontWeight: "600" }}>{a.name}{a.archived ? " (arquivada)" : ""}</Text>
            <Text style={{ color: colors.muted }}>{TYPE_LABEL[a.type]} · {INSTITUTION_LABEL[a.institution]}</Text>
            <Text style={{ fontSize: 18 }}>{formatCents(a.balance.confirmedCents)}</Text>
            {a.balance.pendingCents !== 0 && (
              <Text style={{ color: colors.muted }}>pendente {formatCents(a.balance.pendingCents)}</Text>
            )}
          </Pressable>
        )}
      />
      <Pressable onPress={() => setShowArchived((v) => !v)}>
        <Text style={{ textAlign: "center", color: colors.primary }}>
          {showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
        </Text>
      </Pressable>
      <Button title="Novo lançamento" onPress={() => router.push("/entry-form")} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Button secondary title="Lançamentos" onPress={() => router.push("/transactions")} />
        </View>
        <View style={{ flex: 1 }}>
          <Button secondary title="Nova conta" onPress={() => router.push("/account-form")} />
        </View>
        <View style={{ flex: 1 }}>
          <Button secondary title="Backup" onPress={() => router.push("/settings")} />
        </View>
      </View>
    </View>
  );
}

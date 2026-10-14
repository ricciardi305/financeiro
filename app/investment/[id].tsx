import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { isoDateToBr } from "@/domain/dates";
import { errorMessage } from "@/domain/errors";
import { formatCents } from "@/domain/money";
import { deleteSnapshot, getInvestment, type InvestmentDetail } from "@/services/investments";
import { Button, Text } from "@/ui/form";
import { colors, ripple, spacing, TAP } from "@/ui/theme";
import { toast } from "@/ui/toast";

const signed = (cents: number) => `${cents > 0 ? "+" : ""}${formatCents(cents)}`;

/** An investment account: current value, contributions/redemptions and the yield between balance updates. */
export default function InvestmentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [inv, setInv] = useState<InvestmentDetail>();
  const [version, setVersion] = useState(0);

  useFocusEffect(useCallback(() => setInv(getInvestment(id)), [id, version]));

  const confirmDelete = (snapId: string, date: string) =>
    Alert.alert("Excluir atualização?", `O saldo de ${isoDateToBr(date)} será removido.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          try {
            deleteSnapshot(snapId);
            setVersion((v) => v + 1);
            toast("Atualização excluída");
          } catch (e) {
            Alert.alert("Não foi possível excluir", errorMessage(e));
          }
        },
      },
    ]);

  if (!inv) return null;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: inv.name,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: "/account-form", params: { id } })}
              style={{ minHeight: TAP, justifyContent: "center", paddingHorizontal: spacing.sm }}
            >
              <Text style={{ color: colors.primary, fontWeight: "600" }}>Editar</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View
          style={{
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.surface,
            borderRadius: spacing.sm,
            gap: spacing.xs,
          }}
        >
          <Text style={{ color: colors.muted }}>Valor atual</Text>
          <Text style={{ fontSize: 32, fontWeight: "700" }}>{formatCents(inv.valueCents)}</Text>
          {inv.hasPeriods && (
            <Text style={{ color: inv.totalYieldCents < 0 ? colors.expense : colors.income }}>
              Rendimento acumulado {signed(inv.totalYieldCents)}
            </Text>
          )}
        </View>

        <Button title="Atualizar saldo" onPress={() => router.push({ pathname: "/investment-snapshot", params: { id } })} />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              title="Aplicar"
              onPress={() =>
                router.push({ pathname: "/entry-form", params: { kind: "transfer", toAccountId: id } })
              }
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              secondary
              title="Resgatar"
              onPress={() => router.push({ pathname: "/entry-form", params: { kind: "transfer", accountId: id } })}
            />
          </View>
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontWeight: "600" }}>Atualizações de saldo</Text>
          {inv.rows.length === 0 && (
            <Text style={{ color: colors.muted }}>
              Sem atualizações. Digite o saldo do banco de tempos em tempos para acompanhar o rendimento.
            </Text>
          )}
          {inv.rows.map((r) => (
            <Pressable
              key={r.id}
              onLongPress={() => confirmDelete(r.id, r.date)}
              android_ripple={ripple}
              style={{
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                gap: 2,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text>{isoDateToBr(r.date)}</Text>
                <Text style={{ fontWeight: "600" }}>{formatCents(r.balanceCents)}</Text>
              </View>
              {r.yieldCents !== null && r.flowCents !== null && (
                <Text style={{ color: colors.muted }}>
                  Rendimento {signed(r.yieldCents)} · aportes e resgates {signed(r.flowCents)}
                </Text>
              )}
            </Pressable>
          ))}
          {inv.rows.length > 0 && <Text style={{ color: colors.muted }}>Segure uma atualização para excluir.</Text>}
        </View>
      </ScrollView>
    </View>
  );
}

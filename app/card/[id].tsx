import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { isoDateToBr, shiftMonth } from "@/domain/dates";
import { monthLabel } from "@/domain/dates";
import { errorMessage } from "@/domain/errors";
import { formatCents } from "@/domain/money";
import { getAccount } from "@/services/accounts";
import { currentInvoiceMonth, getInvoiceByMonth, type InvoiceDetail } from "@/services/invoices";
import { deleteTransaction } from "@/services/transactions";
import { Button, HeaderAction, Text } from "@/ui/form";
import { dueText, statusBadge } from "@/ui/invoiceLabels";
import { colors, ripple, spacing, TAP } from "@/ui/theme";
import { toast } from "@/ui/toast";

const short = (d: string) => isoDateToBr(d).slice(0, 5);

/** A credit card: one month at a time, with that month's invoice and its purchases. */
export default function CardScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card] = useState(() => getAccount(id));
  const [startMonth] = useState(() => currentInvoiceMonth(id));
  const [month, setMonth] = useState(startMonth);
  const [inv, setInv] = useState<InvoiceDetail>();
  const [version, setVersion] = useState(0);

  useFocusEffect(useCallback(() => setInv(getInvoiceByMonth(id, month)), [id, month, version]));

  const arrow = (symbol: string, delta: number) => (
    <Pressable
      onPress={() => setMonth((m) => shiftMonth(m, delta))}
      android_ripple={{ ...ripple, borderless: true }}
      style={{ width: TAP, height: TAP, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontSize: 28, color: colors.primary }}>{symbol}</Text>
    </Pressable>
  );

  const confirmDeletePayment = (paymentId: string, amountCents: number) =>
    Alert.alert("Excluir pagamento?", `O pagamento de ${formatCents(amountCents)} será removido da fatura e da conta.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          try {
            deleteTransaction(paymentId);
            setVersion((v) => v + 1);
            toast("Pagamento excluído");
          } catch (e) {
            Alert.alert("Não foi possível excluir", errorMessage(e));
          }
        },
      },
    ]);

  const confirmDeleteRefund = (lineId: string, amountCents: number) =>
    Alert.alert("Excluir estorno?", `O estorno de ${formatCents(amountCents)} será removido da fatura.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          try {
            deleteTransaction(lineId);
            setVersion((v) => v + 1);
            toast("Estorno excluído");
          } catch (e) {
            Alert.alert("Não foi possível excluir", errorMessage(e));
          }
        },
      },
    ]);

  const badge = inv ? statusBadge(inv) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: card.name,
          headerRight: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Pressable
                onPress={() => router.push({ pathname: "/account-form", params: { id } })}
                style={{ minHeight: TAP, justifyContent: "center", paddingHorizontal: spacing.sm }}
              >
                <Text style={{ color: colors.primary, fontWeight: "600" }}>Editar</Text>
              </Pressable>
              <HeaderAction
                symbol="+"
                onPress={() => router.push({ pathname: "/entry-form", params: { accountId: id } })}
              />
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {arrow("‹", -1)}
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "600" }}>{monthLabel(month)}</Text>
            {month !== startMonth && (
              <Pressable onPress={() => setMonth(startMonth)} style={{ minHeight: 32, justifyContent: "center" }}>
                <Text style={{ color: colors.primary }}>Ir para a fatura atual</Text>
              </Pressable>
            )}
          </View>
          {arrow("›", 1)}
        </View>

        {inv && badge && (
          <>
            <View
              style={{
                padding: spacing.lg,
                borderWidth: 1,
                borderColor: inv.status === "open" ? colors.primary : colors.border,
                backgroundColor: colors.surface,
                borderRadius: spacing.sm,
                gap: spacing.xs,
              }}
            >
              <Text style={{ color: badge.color, fontWeight: "600" }}>{badge.label}</Text>
              <Text style={{ color: colors.muted }}>Restante a pagar</Text>
              <Text style={{ fontSize: 32, fontWeight: "700" }}>{formatCents(inv.summary.remainingCents)}</Text>
              <Text style={{ color: colors.muted }}>
                Fecha em {short(inv.closingDate)} · {dueText(inv.dueDate)}
              </Text>
              <View
                style={{
                  marginTop: spacing.sm,
                  paddingTop: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  gap: spacing.xs,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.muted }}>Total da fatura</Text>
                  <Text>{formatCents(inv.summary.totalCents)}</Text>
                </View>
                {inv.summary.paidCents > 0 && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.muted }}>Já pago</Text>
                    <Text style={{ color: colors.income }}>{formatCents(inv.summary.paidCents)}</Text>
                  </View>
                )}
              </View>
            </View>

            {inv.id && inv.summary.remainingCents > 0 && (
              <Button
                title="Registrar pagamento"
                onPress={() => router.push({ pathname: "/pay-invoice", params: { id: inv.id! } })}
              />
            )}

            <Button
              secondary
              title="Lançar estorno ou encargo"
              onPress={() => router.push({ pathname: "/invoice-adjustment", params: { cardId: id, month } })}
            />

            <View style={{ gap: spacing.sm }}>
              <Text style={{ fontWeight: "600" }}>Compras</Text>
              {inv.lines.length === 0 && (
                <Text style={{ color: colors.muted }}>Nenhuma compra nesta fatura.</Text>
              )}
              {inv.lines.map((l) => (
                <Pressable
                  key={l.id}
                  // A refund (positive line) is not editable; long press deletes it.
                  onPress={() =>
                    l.amountCents > 0
                      ? confirmDeleteRefund(l.id, l.amountCents)
                      : router.push({ pathname: "/entry-form", params: { id: l.id } })
                  }
                  android_ripple={ripple}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    gap: spacing.md,
                    paddingVertical: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text>{l.amountCents > 0 ? `${l.description} (estorno)` : l.description}</Text>
                    <Text style={{ color: colors.muted }}>
                      {short(l.occurredOn)}
                      {l.installmentTotal ? ` · parcela ${l.installmentNumber}/${l.installmentTotal}` : ""}
                    </Text>
                  </View>
                  <Text style={{ color: l.amountCents > 0 ? colors.income : colors.text }}>
                    {formatCents(-l.amountCents)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {inv.payments.length > 0 && (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ fontWeight: "600" }}>Pagamentos</Text>
                {inv.payments.map((p) => (
                  <Pressable
                    key={p.id}
                    onLongPress={() => confirmDeletePayment(p.id, p.amountCents)}
                    android_ripple={ripple}
                    style={{ flexDirection: "row", justifyContent: "space-between", minHeight: TAP, alignItems: "center" }}
                  >
                    <Text style={{ color: colors.muted }}>{short(p.occurredOn)}</Text>
                    <Text style={{ color: colors.income }}>{formatCents(p.amountCents)}</Text>
                  </Pressable>
                ))}
                <Text style={{ color: colors.muted }}>Segure um pagamento para excluir.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

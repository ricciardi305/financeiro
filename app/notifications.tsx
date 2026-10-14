import { useCallback, useState } from "react";
import { Alert, AppState, ScrollView, View } from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { errorMessage } from "@/domain/errors";
import {
  clearNotifications,
  countByPackage,
  exportNotificationsJson,
  recentNotifications,
  type RawNotification,
} from "@/services/notifications";
import { isListenerEnabled, openListenerSettings, rebindListener } from "../modules/notification-listener";
import { Button, Text } from "@/ui/form";
import { colors, spacing } from "@/ui/theme";
import { toast } from "@/ui/toast";

const APP_NAME: Record<string, string> = {
  "com.nu.production": "Nubank",
  "br.com.intermedium": "Inter",
  "com.mercadopago.wallet": "Mercado Pago",
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Debug screen for the notification capture: permission, what arrived, and a JSON export of the raw samples. */
export default function Notifications() {
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState<RawNotification[]>([]);
  const [totals, setTotals] = useState<{ packageName: string; total: number }[]>([]);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    setEnabled(isListenerEnabled());
    setRows(recentNotifications());
    setTotals(countByPackage());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      // Coming back from the system settings screen: re-read the permission.
      const sub = AppState.addEventListener("change", (s) => s === "active" && refresh());
      return () => sub.remove();
    }, [refresh, version]),
  );

  const doExport = async () => {
    try {
      const name = await exportNotificationsJson();
      if (name) toast(`Exportado: ${name}`);
    } catch (e) {
      Alert.alert("Não foi possível exportar", errorMessage(e));
    }
  };

  const doClear = () =>
    Alert.alert("Apagar notificações capturadas?", "Só as cópias guardadas no app; as notificações do celular não mudam.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: () => {
          clearNotifications();
          setVersion((v) => v + 1);
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: "Notificações" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <View
          style={{
            padding: spacing.lg,
            borderWidth: 1,
            borderColor: enabled ? colors.income : colors.expense,
            backgroundColor: colors.surface,
            borderRadius: spacing.sm,
            gap: spacing.xs,
          }}
        >
          <Text style={{ fontWeight: "600", color: enabled ? colors.income : colors.expense }}>
            {enabled ? "Captura ligada" : "Captura desligada"}
          </Text>
          <Text style={{ color: colors.muted }}>
            Guarda as notificações do Nubank, Inter e Mercado Pago, mesmo com o app fechado. Nada sai do aparelho.
          </Text>
          {totals.map((t) => (
            <Text key={t.packageName}>
              {APP_NAME[t.packageName] ?? t.packageName}: {t.total}
            </Text>
          ))}
        </View>

        {!enabled && (
          <>
            <Button title="Dar acesso às notificações" onPress={openListenerSettings} />
            <Text style={{ color: colors.muted }}>
              Na lista, ligue "Financeiro". Se o item estiver cinza ou aparecer "configuração restrita", abra Informações
              do app, toque nos três pontos e escolha "Permitir configurações restritas".
            </Text>
          </>
        )}
        {enabled && <Button secondary title="Reconectar a captura" onPress={rebindListener} />}

        <Button secondary title="Exportar JSON" onPress={doExport} />
        <Button secondary title="Apagar capturadas" onPress={doClear} danger />

        <View style={{ gap: spacing.sm }}>
          <Text style={{ fontWeight: "600" }}>Últimas notificações</Text>
          {rows.length === 0 && <Text style={{ color: colors.muted }}>Nada capturado ainda.</Text>}
          {rows.map((r) => (
            <View
              key={r.id}
              style={{ paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 2 }}
            >
              <Text style={{ color: colors.muted }}>
                {APP_NAME[r.packageName] ?? r.packageName} · {when(r.postedAt)}
              </Text>
              {r.title ? <Text style={{ fontWeight: "600" }}>{r.title}</Text> : null}
              <Text>{r.bigText ?? r.text ?? ""}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

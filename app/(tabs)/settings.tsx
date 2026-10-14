import { useState } from "react";
import { Alert, View } from "react-native";
import { useRouter } from "expo-router";
import { errorMessage } from "@/domain/errors";
import { exportBackup, importBackup } from "@/services/backup";
import { Button, Text } from "@/ui/form";
import { colors, spacing } from "@/ui/theme";
import { toast } from "@/ui/toast";

export default function Settings() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const run = async (job: () => Promise<void>, errorTitle: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await job();
    } catch (e) {
      Alert.alert(errorTitle, errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const doExport = () =>
    run(async () => {
      const name = await exportBackup();
      if (name) toast(`Backup salvo: ${name}`);
    }, "Não foi possível exportar");

  const doImport = () =>
    Alert.alert(
      "Importar backup?",
      "Todos os dados atuais serão substituídos pelos do arquivo. Uma cópia dos dados atuais é guardada antes (financeiro-before-import.db, na pasta do app).",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Importar",
          style: "destructive",
          onPress: () => run(async () => void (await importBackup()), "Não foi possível importar"),
        },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, gap: spacing.lg }}>
      <Text style={{ color: colors.muted }}>
        Os dados ficam só neste aparelho. Exporte um backup com frequência e guarde o arquivo fora do celular.
      </Text>
      <Button title="Exportar backup (.db)" onPress={doExport} />
      <Button title="Importar backup" onPress={doImport} danger />
      <Button secondary title="Notificações capturadas" onPress={() => router.push("/notifications")} />
    </View>
  );
}

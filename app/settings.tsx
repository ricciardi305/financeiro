import { useState } from "react";
import { Alert, View } from "react-native";
import { Stack } from "expo-router";
import { errorMessage } from "@/domain/errors";
import { exportBackup, importBackup } from "@/services/backup";
import { Button, Text } from "@/ui/form";
import { colors } from "@/ui/theme";

export default function Settings() {
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
      if (name) Alert.alert("Backup salvo", `Arquivo: ${name}`);
    }, "Não foi possível exportar");

  const doImport = () =>
    Alert.alert(
      "Importar backup?",
      "Todos os dados atuais serão substituídos pelos do arquivo. Uma cópia dos dados atuais é guardada antes (financeiro-before-import.db, na pasta do app).",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Importar", style: "destructive", onPress: () => run(async () => void (await importBackup()), "Não foi possível importar") },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 16 }}>
      <Stack.Screen options={{ title: "Backup" }} />
      <Text style={{ color: colors.muted }}>
        Os dados ficam só neste aparelho. Exporte um backup com frequência e guarde o arquivo fora do celular.
      </Text>
      <Button title="Exportar backup (.db)" onPress={doExport} />
      <Button title="Importar backup" onPress={doImport} danger />
    </View>
  );
}

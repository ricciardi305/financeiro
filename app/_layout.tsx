import { Stack } from "expo-router";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Text, View } from "react-native";
import { db } from "@/db/client";
import migrations from "@/db/migrations/migrations";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text>Erro ao migrar o banco: {error.message}</Text>
      </View>
    );
  }
  if (!success) return null;
  return <Stack />;
}

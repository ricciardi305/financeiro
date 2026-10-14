import { useEffect } from "react";
import { Stack } from "expo-router";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { AppState, View } from "react-native";
import { db } from "@/db/client";
import migrations from "@/db/migrations/migrations";
import { seedCategories } from "@/db/seeds";
import { generateOccurrences } from "@/services/recurrences";
import { Text } from "@/ui/form";
import { syncInbox } from "@/ui/inbox";
import { colors, spacing } from "@/ui/theme";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  // Captured notifications become pending transactions on open and whenever the app returns to the foreground.
  useEffect(() => {
    if (!success) return;
    syncInbox();
    const sub = AppState.addEventListener("change", (s) => s === "active" && syncInbox());
    return () => sub.remove();
  }, [success]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.bg }}>
        <Text>Erro ao migrar o banco: {error.message}</Text>
      </View>
    );
  }
  if (!success) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  seedCategories();
  generateOccurrences();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}

import { Stack } from "expo-router";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { View } from "react-native";
import { db } from "@/db/client";
import migrations from "@/db/migrations/migrations";
import { seedCategories } from "@/db/seeds";
import { Text } from "@/ui/form";
import { colors, spacing } from "@/ui/theme";

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.bg }}>
        <Text>Erro ao migrar o banco: {error.message}</Text>
      </View>
    );
  }
  if (!success) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  seedCategories();
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

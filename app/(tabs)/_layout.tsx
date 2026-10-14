import { Ionicons } from "@expo/vector-icons";
import type { ColorValue } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { HeaderAction } from "@/ui/form";
import { colors } from "@/ui/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => (
  <Ionicons name={name} color={color} size={size} />
);

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Contas",
          tabBarIcon: icon("wallet-outline"),
          headerRight: () => <HeaderAction symbol="+" onPress={() => router.push("/account-form")} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Lançamentos",
          tabBarIcon: icon("swap-vertical"),
          headerRight: () => <HeaderAction symbol="+" onPress={() => router.push("/entry-form")} />,
        }}
      />
      <Tabs.Screen
        name="month"
        options={{
          title: "Contas do mês",
          tabBarLabel: "Mês",
          tabBarIcon: icon("calendar-outline"),
          headerRight: () => <HeaderAction symbol="+" onPress={() => router.push("/recurrence-form")} />,
        }}
      />
      <Tabs.Screen name="settings" options={{ title: "Backup", tabBarIcon: icon("save-outline") }} />
    </Tabs>
  );
}

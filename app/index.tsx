import { Text, View } from "react-native";
import { count } from "drizzle-orm";
import { db } from "@/db/client";
import { categories } from "@/db/schema";

export default function Index() {
  // Phase 1 smoke test; replaced by real screens.
  const [{ n }] = db.select({ n: count() }).from(categories).all();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Financeiro</Text>
      <Text>{n} categorias</Text>
    </View>
  );
}

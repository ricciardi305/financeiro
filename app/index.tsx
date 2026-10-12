import { Text, View } from "react-native";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { appMeta } from "@/db/schema";

export default function Index() {
  // Smoke test of the DB pipeline (runs only after migrations); replaced in phase 1.
  db.insert(appMeta).values({ key: "first_run", value: new Date().toISOString() }).onConflictDoNothing().run();
  const [{ n }] = db.select({ n: sql<number>`count(*)` }).from(appMeta).all();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Financeiro</Text>
      <Text>Banco OK ({n} registro)</Text>
    </View>
  );
}

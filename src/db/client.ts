import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

export const sqlite = openDatabaseSync("financeiro.db");
export const db = drizzle(sqlite);

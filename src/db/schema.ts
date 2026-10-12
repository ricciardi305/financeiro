import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// Placeholder to prove the migration pipeline; real tables arrive in phase 1.
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

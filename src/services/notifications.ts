import { count, desc, eq } from "drizzle-orm";
import { Directory } from "expo-file-system";
import { db } from "@/db/client";
import { rawNotifications } from "@/db/schema";

export type RawNotification = typeof rawNotifications.$inferSelect;

export const recentNotifications = (limit = 50): RawNotification[] =>
  db.select().from(rawNotifications).orderBy(desc(rawNotifications.postedAt)).limit(limit).all();

export const countByPackage = (): { packageName: string; total: number }[] =>
  db
    .select({ packageName: rawNotifications.packageName, total: count() })
    .from(rawNotifications)
    .groupBy(rawNotifications.packageName)
    .all();

export const deleteNotification = (id: string): void => {
  db.delete(rawNotifications).where(eq(rawNotifications.id, id)).run();
};

export const clearNotifications = (): void => {
  db.delete(rawNotifications).run();
};

const wasCanceled = (e: unknown) => /cancel/i.test(e instanceof Error ? e.message : String(e));
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");

/**
 * Saves every captured notification as JSON in a folder the user picks (samples for writing parsers).
 * Returns the file name, or null if canceled. The file has real personal data: anonymize before sharing.
 */
export async function exportNotificationsJson(): Promise<string | null> {
  const rows = db.select().from(rawNotifications).orderBy(rawNotifications.postedAt).all();
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch (e) {
    if (wasCanceled(e)) return null;
    throw e;
  }
  const file = dir.createFile(`notificacoes-${stamp()}.json`, "application/json");
  file.write(JSON.stringify(rows, null, 2));
  return file.name;
}

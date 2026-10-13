import { reloadAppAsync } from "expo";
import { deserializeDatabaseSync } from "expo-sqlite";
import { Directory, File, Paths } from "expo-file-system";
import { sqlite } from "@/db/client";
import { UserError } from "@/domain/errors";

const SQLITE_MAGIC = "SQLite format 3\0";

const toUri = (path: string) => (path.startsWith("/") ? `file://${path}` : path);

const wasCanceled = (e: unknown) => /cancel/i.test(e instanceof Error ? e.message : String(e));

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");

/** Copies a consistent snapshot of the database into a folder the user picks. Returns the file name, or null if canceled. */
export async function exportBackup(): Promise<string | null> {
  const bytes = await sqlite.serializeAsync();
  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch (e) {
    if (wasCanceled(e)) return null;
    throw e;
  }
  const file = dir.createFile(`financeiro-${stamp()}.db`, "application/x-sqlite3");
  file.write(bytes);
  return file.name;
}

function isValidBackup(bytes: Uint8Array): boolean {
  if (String.fromCharCode(...bytes.slice(0, 16)) !== SQLITE_MAGIC) return false;
  const probe = deserializeDatabaseSync(bytes);
  try {
    return !!probe.getFirstSync("select 1 from sqlite_master where name = 'transactions'");
  } finally {
    probe.closeSync();
  }
}

/**
 * Replaces the whole database with a backup picked by the user, then reloads the app.
 * The current data is saved first to the app's document folder as a safety copy.
 * Returns false if the user canceled the picker.
 */
export async function importBackup(): Promise<boolean> {
  let picked: File;
  try {
    const res = await File.pickFileAsync({ mimeTypes: "*/*" });
    if (res.canceled) return false;
    picked = res.result;
  } catch (e) {
    if (wasCanceled(e)) return false;
    throw e;
  }

  const bytes = await picked.bytes();
  if (!isValidBackup(bytes)) throw new UserError("Esse arquivo não é um backup válido do Financeiro.");

  const current = await sqlite.serializeAsync();
  new File(Paths.document, "financeiro-before-import.db").write(current);

  const dbPath = toUri(sqlite.databasePath);
  sqlite.closeSync();
  new File(dbPath).write(bytes);
  for (const suffix of ["-wal", "-shm"]) {
    const side = new File(dbPath + suffix);
    if (side.exists) side.delete();
  }
  await reloadAppAsync();
  return true;
}

package expo.modules.notificationlistener

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

data class RawNotification(
  val packageName: String,
  val title: String?,
  val text: String?,
  val bigText: String?,
  val postedAtMillis: Long,
  val key: String,
)

/**
 * Writes straight into the app's SQLite file (`raw_notifications`, created by the JS migrations), so capture
 * works with the app closed. A connection is opened per insert: a backup import can replace the file at any time.
 */
object RawNotificationStore {
  private const val TAG = "RawNotificationStore"

  private fun iso(millis: Long): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
      .format(Date(millis))

  fun insert(context: Context, n: RawNotification): Boolean {
    val file = File(context.filesDir, "SQLite/financeiro.db")
    if (!file.exists()) return false
    var db: SQLiteDatabase? = null
    return try {
      db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READWRITE)
      db.rawQuery("PRAGMA busy_timeout = 5000", null).close()
      // OR IGNORE: the unique (sbn_key, posted_at) index drops repeated deliveries of the same notification.
      db.execSQL(
        "INSERT OR IGNORE INTO raw_notifications (id, package_name, title, text, big_text, posted_at, sbn_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        arrayOf<Any?>(UUID.randomUUID().toString(), n.packageName, n.title, n.text, n.bigText, iso(n.postedAtMillis), n.key, iso(System.currentTimeMillis())),
      )
      true
    } catch (e: Exception) {
      // Typically the table does not exist yet (the app was never opened after the update).
      Log.w(TAG, "could not store notification: ${e.message}")
      false
    } finally {
      db?.close()
    }
  }
}

package expo.modules.notificationlistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

class NotificationCaptureService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName !in WATCHED_PACKAGES) return
    val extras = sbn.notification.extras
    RawNotificationStore.insert(
      applicationContext,
      RawNotification(
        packageName = sbn.packageName,
        title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
        text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
        bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
        postedAtMillis = sbn.postTime,
        key = sbn.key,
      ),
    )
  }
}

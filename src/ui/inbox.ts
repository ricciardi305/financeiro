import { create } from "zustand";
import { inboxCount, processNotifications } from "@/services/capture";

type InboxState = { count: number };

export const useInbox = create<InboxState>(() => ({ count: 0 }));

/** Recounts the pending items (after confirming or discarding one). */
export function refreshInbox(): void {
  useInbox.setState({ count: inboxCount() });
}

/** Turns newly captured notifications into pending transactions, then recounts. Call only after migrations. */
export function syncInbox(): void {
  try {
    processNotifications();
  } finally {
    refreshInbox();
  }
}

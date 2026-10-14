import { requireNativeModule } from "expo";

type Native = {
  isEnabled(): boolean;
  openSettings(): void;
  rebind(): void;
  watchedPackages(): string[];
};

const native = requireNativeModule<Native>("NotificationListener");

/** Whether the user granted this app notification access. */
export const isListenerEnabled = (): boolean => native.isEnabled();
/** Opens the system screen where notification access is granted. */
export const openListenerSettings = (): void => native.openSettings();
/** Asks the system to reconnect the listener (it can be dropped by battery savers). */
export const rebindListener = (): void => native.rebind();
/** Packages whose notifications are stored. */
export const watchedPackages = (): string[] => native.watchedPackages();

import { ToastAndroid } from "react-native";

/** Short confirmation at the bottom of the screen (Android only, which is the only target). */
export const toast = (message: string): void => ToastAndroid.show(message, ToastAndroid.SHORT);

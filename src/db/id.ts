// Lazy require: drizzle-kit loads schema.ts in plain Node, where expo-crypto can't be imported.
export const newId = (): string => require("expo-crypto").randomUUID();

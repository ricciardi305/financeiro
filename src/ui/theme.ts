/** The app is dark-only for now (app.json forces userInterfaceStyle: dark). */
export const colors = {
  bg: "#0a0f1c",
  surface: "#131c2f",
  surfaceHigh: "#1a2540", // hero cards, one step above surface
  border: "#27344d",
  text: "#e5e7eb",
  muted: "#94a3b8",
  placeholder: "#7d8aa3", // 4.9:1 on surface
  primary: "#3b82f6",
  primaryText: "#ffffff",
  chipOn: "#1e3a8a",
  income: "#4ade80",
  incomeBg: "rgba(74,222,128,0.14)",
  expense: "#f87171",
  expenseBg: "rgba(248,113,113,0.14)",
  warnBg: "rgba(250,204,21,0.14)",
  warn: "#facc15",
  neutralBg: "rgba(148,163,184,0.16)",
  dangerBg: "#3b1519",
  dangerText: "#fca5a5",
} as const;

/** 4/8pt scale; use these instead of raw numbers in styles. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Card corner radius (rounder than controls, as in Nubank/Revolut). */
export const RADIUS = 16;

/** Minimum comfortable touch target (Material: 48dp). */
export const TAP = 48;

export const ripple = { color: "rgba(255,255,255,0.12)" } as const;

/** Brand colours for the institution avatar on account rows. */
export const institutionColor: Record<string, string> = {
  nubank: "#8a05be",
  inter: "#ff7a00",
  mercadopago: "#009ee3",
  other: "#475569",
};

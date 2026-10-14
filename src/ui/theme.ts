/** The app is dark-only for now (app.json forces userInterfaceStyle: dark). */
export const colors = {
  bg: "#0b1220",
  surface: "#131c2f",
  border: "#27344d",
  text: "#e5e7eb",
  muted: "#94a3b8",
  placeholder: "#7d8aa3", // 4.9:1 on surface
  primary: "#3b82f6",
  primaryText: "#ffffff",
  chipOn: "#1e3a8a",
  income: "#4ade80",
  expense: "#f87171",
  dangerBg: "#3b1519",
  dangerText: "#fca5a5",
} as const;

/** 4/8pt scale; use these instead of raw numbers in styles. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Minimum comfortable touch target (Material: 48dp). */
export const TAP = 48;

export const ripple = { color: "rgba(255,255,255,0.12)" } as const;

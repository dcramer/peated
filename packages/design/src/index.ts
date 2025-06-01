// Static theme object for v4 compatibility
// Since resolveConfig is no longer available in v4, we provide static theme values
const theme = {
  colors: {
    transparent: "transparent",
    current: "currentColor",
    muted: "#94a3b8", // slate-400
    "muted-dark": "#64748b", // slate-500
    highlight: "#fbbf24", // amber-400
    "highlight-dark": "#92400e", // amber-800
    // Add other colors as needed
    white: "#ffffff",
    black: "#000000",
    slate: {
      50: "#f8fafc",
      100: "#f1f5f9",
      200: "#e2e8f0",
      300: "#cbd5e1",
      400: "#94a3b8",
      500: "#64748b",
      600: "#475569",
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
      950: "#020617",
    },
    amber: {
      50: "#fffbeb",
      100: "#fef3c7",
      200: "#fde68a",
      300: "#fcd34d",
      400: "#fbbf24",
      500: "#f59e0b",
      600: "#d97706",
      700: "#b45309",
      800: "#92400e",
      900: "#78350f",
      950: "#451a03",
    },
  },
  fontFamily: {
    sans: ["Raleway", "ui-sans-serif", "system-ui", "sans-serif"],
  },
};

export default theme;

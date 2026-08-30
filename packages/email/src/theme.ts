/** Fixed email colors. Email rendering must not depend on the web styling toolchain. */
const emailTheme = {
  colors: {
    black: "#000000",
    highlight: "#fbbf24",
    muted: "#94a3b8",
    slate: {
      700: "#334155",
      800: "#1e293b",
      900: "#0f172a",
    },
    white: "#ffffff",
  },
} as const;

export default emailTheme;

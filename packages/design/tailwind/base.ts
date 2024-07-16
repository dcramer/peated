import type { Config } from "tailwindcss";

import colors from "tailwindcss/colors";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        transparent: "transparent",
        current: "currentColor",
        light: colors.slate[400],
        highlight: {
          DEFAULT: colors.amber[400],
          dark: colors.amber[800],
        },
        background: {
          DEFAULT: "#111111",
          alt: "#1F1F1F",
        },
      },
      fontFamily: {
        sans: ["Raleway", ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
} satisfies Config;

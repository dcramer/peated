import type { Config } from "tailwindcss";

import colors from "tailwindcss/colors";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        transparent: "transparent",
        current: "currentColor",
        muted: colors.slate[400],
        "muted-dark": colors.slate[500],
        highlight: colors.amber[400],
        "highlight-dark": colors.amber[800],
      },
    },
  },
  plugins: [],
} satisfies Config;

import type { Config } from "tailwindcss";

import preset from "@peated/design/tailwind.config";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  presets: [preset],
} satisfies Config;

import type { Config } from "tailwindcss";

import preset from "@peated/design/tailwind/web";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  presets: [preset],
} as Config;

import type { Config } from "tailwindcss";

import baseConfig from "./base";

export default {
  content: baseConfig.content,
  presets: [baseConfig],
} satisfies Config;

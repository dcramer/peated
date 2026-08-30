import type { UserOptions as StyleXOptions } from "@stylexjs/unplugin";
import stylex from "@stylexjs/unplugin";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
// SAFETY: stylex.config.cjs owns this function and returns StyleX compiler options.
const { stylexOptions } = require("./stylex.config.cjs") as {
  stylexOptions: (options: { dev: boolean; test: boolean }) => StyleXOptions;
};

export default defineConfig({
  plugins: [
    stylex.raw(
      {
        ...stylexOptions({ dev: false, test: true }),
        useCSSLayers: false,
      },
      { framework: "vite" },
    ),
    react(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "visual/**/*.test.mjs"],
    restoreMocks: true,
  },
});

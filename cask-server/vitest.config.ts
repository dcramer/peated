/// <reference types="vitest" />
/// <reference types="vite/client" />

import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    coverage: {
      reporter: ["json"],
    },
    globals: true,
    setupFiles: ["./src/test/setup-test-env.ts"],
    include: ["./src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    watchExclude: [
      ".*\\/node_modules\\/.*",
      ".*\\/dist\\/.*",
      ".*\\/postgres-data\\/.*",
    ],
  },
});

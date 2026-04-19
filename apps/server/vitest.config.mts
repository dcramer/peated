import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    watch: {
      ignored: ["**/node_modules/**", "**/dist/**", "**/postgres-data/**"],
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["json"],
    },
    maxConcurrency: 1,
    pool: "forks",
    fileParallelism: false,
    globals: true,
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup-test-env.ts"],
    include: ["./src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    restoreMocks: true,
  },
});

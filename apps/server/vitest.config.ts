import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
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
    poolOptions: {
      forks: {
        singleFork: true,
      },
      threads: {
        singleThread: true,
      },
    },
    fileParallelism: false,
    globals: true,
    setupFiles: ["./src/test/setup-test-env.ts"],
    include: ["./src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    restoreMocks: true,
  },
});

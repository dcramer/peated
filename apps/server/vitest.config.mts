import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { linkedWorktreeName, testDatabaseUrl } from "./src/test/database-url";

// Set before global setup and test workers start, so both see the same database.
const databaseUrl = testDatabaseUrl(
  process.env.DATABASE_URL,
  linkedWorktreeName(fileURLToPath(new URL("../..", import.meta.url))),
);
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

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
    maxConcurrency: 1,
    pool: "forks",
    fileParallelism: false,
    globals: true,
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup-test-env.ts"],
    include: ["./src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["./src/**/*.eval.test.ts"],
    restoreMocks: true,
  },
});

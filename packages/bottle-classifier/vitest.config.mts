import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.eval.test.ts"],
    restoreMocks: true,
  },
});

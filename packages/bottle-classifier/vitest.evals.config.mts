import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    include: ["src/**/*.eval.test.ts"],
    maxConcurrency: 1,
    reporters: ["vitest-evals/reporter"],
    testTimeout: 180000,
  },
});

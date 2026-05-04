import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      VITEST_EVALS_REPLAY_DIR:
        process.env.VITEST_EVALS_REPLAY_DIR ?? "eval-cassettes/replay",
      VITEST_EVALS_REPLAY_MODE: process.env.VITEST_EVALS_REPLAY_MODE ?? "auto",
    },
    include: ["src/**/*.eval.test.ts"],
    maxConcurrency: 1,
    reporters: ["vitest-evals/reporter"],
    testTimeout: 300000,
  },
});

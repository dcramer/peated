import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = path.resolve(packageRoot, "../..");
const AI_ENV_KEYS = [
  "AI_GATEWAY_API_KEY",
  "OPENAI_MODEL",
  "SCRAPER_AI_GATEWAY_API_KEY",
] as const;

function applyAiEnvFile(absolutePath: string): void {
  if (!fs.existsSync(absolutePath)) return;

  const values = parseEnv(fs.readFileSync(absolutePath, "utf8"));
  for (const name of AI_ENV_KEYS) {
    if (process.env[name] === undefined && values[name] !== undefined) {
      process.env[name] = values[name];
    }
  }
}

applyAiEnvFile(path.resolve(workspaceRoot, ".env.local"));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    fileParallelism: false,
    globalSetup: ["./src/test/global-setup.ts"],
    globals: true,
    include: ["./src/**/*.eval.test.ts"],
    maxConcurrency: 1,
    pool: "forks",
    setupFiles: ["./src/test/setup-test-env.ts"],
    testTimeout: 300_000,
  },
});

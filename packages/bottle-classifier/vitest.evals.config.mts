import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = path.resolve(packageRoot, "../..");

function createEnvFileLoader(
  targetEnv: NodeJS.ProcessEnv = process.env,
): (absolutePath: string) => void {
  const protectedKeys = new Set(Object.keys(targetEnv));
  const loadedKeys = new Set<string>();

  return (absolutePath: string) => {
    if (!fs.existsSync(absolutePath)) {
      return;
    }

    const values = parseEnv(fs.readFileSync(absolutePath, "utf8"));
    for (const [name, value] of Object.entries(values)) {
      if (protectedKeys.has(name) && !loadedKeys.has(name)) {
        continue;
      }

      targetEnv[name] = value;
      loadedKeys.add(name);
    }
  };
}

const applyEnvFile = createEnvFileLoader();
for (const envFile of [".env", ".env.local"]) {
  applyEnvFile(path.resolve(workspaceRoot, envFile));
}

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

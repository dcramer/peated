import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

const packageRoot = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = path.resolve(packageRoot, "../..");
const replayRoot = path.resolve(packageRoot, ".vitest-evals/recordings");

function applyEnvFile(
  absolutePath: string,
  targetEnv: NodeJS.ProcessEnv = process.env,
): void {
  if (!fs.existsSync(absolutePath)) {
    return;
  }

  const protectedKeys = new Set(Object.keys(targetEnv));
  const values = parseEnv(fs.readFileSync(absolutePath, "utf8"));
  for (const [name, value] of Object.entries(values)) {
    if (protectedKeys.has(name)) {
      continue;
    }

    targetEnv[name] = value;
  }
}

applyEnvFile(path.resolve(workspaceRoot, ".env.local"));

function pickDefinedEnv(keys: string[]): Record<string, string> {
  return Object.fromEntries(
    keys.flatMap((key) => {
      const value = process.env[key];
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

export default defineConfig({
  root: packageRoot,
  test: {
    fileParallelism: false,
    env: {
      ...pickDefinedEnv([
        "AI_GATEWAY_API_KEY",
        "OPENAI_API_KEY",
        "OPENAI_HOST",
        "OPENAI_IMAGE_EXTRACTION_MODEL",
        "OPENAI_IMAGE_EXTRACTION_REASONING_EFFORT",
        "OPENAI_ORGANIZATION",
        "OPENAI_PROJECT",
        "OPENAI_EVAL_MODEL",
        "OPENAI_MODEL",
        "OPENAI_REASONING_EFFORT",
        "FIRECRAWL_API_KEY",
        "FIRECRAWL_API_URL",
        "BOTTLE_CLASSIFIER_EVAL_MAX_SEARCH_QUERIES",
      ]),
      VITEST_EVALS_REPLAY_DIR:
        process.env.VITEST_EVALS_REPLAY_DIR ?? replayRoot,
      VITEST_EVALS_REPLAY_MODE: process.env.VITEST_EVALS_REPLAY_MODE ?? "auto",
    },
    include: ["src/**/*.eval.test.ts"],
    maxConcurrency: 1,
    reporters: ["vitest-evals/reporter"],
    testTimeout: 300000,
  },
});

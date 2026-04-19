import { readdir, rm } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

function getCacheDir() {
  if (process.env.BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_DIR?.trim()) {
    return process.env.BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_DIR;
  }

  if (process.env.BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_PATH?.trim()) {
    const configuredPath =
      process.env.BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_PATH;
    return extname(configuredPath).toLowerCase() === ".json"
      ? join(dirname(configuredPath), basename(configuredPath, ".json"))
      : configuredPath;
  }

  return fileURLToPath(
    new URL("../eval-cassettes/web-search", import.meta.url),
  );
}

const cacheDir = getCacheDir();

try {
  const entries = await readdir(cacheDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.name !== ".gitkeep")
      .map((entry) =>
        rm(join(cacheDir, entry.name), {
          force: true,
          recursive: true,
        }),
      ),
  );
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

console.log(`Cleared classifier eval web search cassettes at ${cacheDir}`);

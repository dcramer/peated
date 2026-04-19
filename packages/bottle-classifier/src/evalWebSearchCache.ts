import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { BottleWebSearchExecutionCache } from "./tools/sharedWebSearch";

const EVAL_WEB_SEARCH_CACHE_VERSION = 1;
// Bump only when the meaning of cassette lookup changes and older cassettes
// should no longer be considered replay-compatible.
const EVAL_WEB_SEARCH_CACHE_KEY_VERSION = 1;

const EvalWebSearchCacheModeSchema = z.enum([
  "live",
  "refresh",
  "replay_only",
  "replay_or_record",
]);

const EvalWebSearchCacheEntrySchema = z.object({
  key: z.record(z.string(), z.unknown()),
  recordedAt: z.string().min(1),
  value: z.unknown(),
});

const EvalWebSearchCassetteSchema = z.object({
  version: z.number().int().min(1),
  entry: EvalWebSearchCacheEntrySchema,
});

type EvalWebSearchCassette = z.infer<typeof EvalWebSearchCassetteSchema>;
type EvalWebSearchCacheMode = z.infer<typeof EvalWebSearchCacheModeSchema>;

function getDefaultCacheDir() {
  return fileURLToPath(
    new URL("../eval-cassettes/web-search", import.meta.url),
  );
}

function normalizeConfiguredCacheDir(configuredPath: string): string {
  const trimmedPath = configuredPath.trim();
  if (!trimmedPath) {
    return getDefaultCacheDir();
  }

  if (extname(trimmedPath).toLowerCase() === ".json") {
    return join(dirname(trimmedPath), basename(trimmedPath, ".json"));
  }

  return trimmedPath;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );

    return `{${entries
      .map(
        ([key, nestedValue]) =>
          `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`,
      )
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function buildCacheKey(key: Record<string, unknown>): string {
  return createHash("sha1").update(stableSerialize(key)).digest("hex");
}

function normalizeCacheKey(
  key: Record<string, unknown>,
): Record<string, unknown> {
  const toolName =
    typeof key.toolName === "string" && key.toolName.trim().length > 0
      ? key.toolName
      : "web_search";
  const query =
    typeof key.query === "string" && key.query.trim().length > 0
      ? key.query
      : "";

  if (toolName === "openai_web_search") {
    return {
      cacheKeyVersion: EVAL_WEB_SEARCH_CACHE_KEY_VERSION,
      toolName,
      model: typeof key.model === "string" ? key.model : null,
      query,
    };
  }

  if (toolName === "brave_web_search") {
    return {
      cacheKeyVersion: EVAL_WEB_SEARCH_CACHE_KEY_VERSION,
      toolName,
      query,
    };
  }

  return {
    cacheKeyVersion: EVAL_WEB_SEARCH_CACHE_KEY_VERSION,
    ...Object.fromEntries(
      Object.entries(key).filter(([, value]) => value !== undefined),
    ),
  };
}

function cacheKeysMatch(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return stableSerialize(normalizeCacheKey(left)) === stableSerialize(right);
}

function slugifyKeyPart(value: unknown): string {
  const slug = String(value ?? "query")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "query";
}

function isTopLevelErrorResult(value: unknown): value is { error: string } {
  return (
    !!value &&
    typeof value === "object" &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string"
  );
}

function isNonCacheableResult(value: unknown): boolean {
  if (isTopLevelErrorResult(value)) {
    return true;
  }

  if (
    value &&
    typeof value === "object" &&
    "result" in value &&
    isTopLevelErrorResult((value as { result?: unknown }).result)
  ) {
    return true;
  }

  return false;
}

function getCassettePath({
  cacheDir,
  key,
}: {
  cacheDir: string;
  key: Record<string, unknown>;
}) {
  const normalizedKey = normalizeCacheKey(key);
  const cacheKey = buildCacheKey(normalizedKey);
  const toolName = slugifyKeyPart(normalizedKey.toolName ?? "web-search");
  const query = slugifyKeyPart(normalizedKey.query);
  return join(cacheDir, toolName, `${query}--${cacheKey}.json`);
}

async function loadCassette(
  cassettePath: string,
): Promise<EvalWebSearchCassette | null> {
  try {
    const raw = await readFile(cassettePath, "utf8");
    return EvalWebSearchCassetteSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeCassette(
  cassettePath: string,
  cassette: EvalWebSearchCassette,
) {
  await mkdir(dirname(cassettePath), { recursive: true });
  await writeFile(
    cassettePath,
    `${JSON.stringify(cassette, null, 2)}\n`,
    "utf8",
  );
}

async function findMatchingCassette({
  cacheDir,
  key,
}: {
  cacheDir: string;
  key: Record<string, unknown>;
}): Promise<null | {
  cassette: EvalWebSearchCassette;
  cassettePath: string;
}> {
  const cassettePath = getCassettePath({
    cacheDir,
    key,
  });
  const exactCassette = await loadCassette(cassettePath);
  if (exactCassette) {
    return {
      cassette: exactCassette,
      cassettePath,
    };
  }

  const normalizedKey = normalizeCacheKey(key);
  const toolDir = join(
    cacheDir,
    slugifyKeyPart(normalizedKey.toolName ?? "web-search"),
  );
  const queryPrefix = `${slugifyKeyPart(normalizedKey.query)}--`;

  let candidateFiles: string[];
  try {
    candidateFiles = await readdir(toolDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }

  for (const candidateFile of candidateFiles) {
    if (
      !candidateFile.endsWith(".json") ||
      !candidateFile.startsWith(queryPrefix)
    ) {
      continue;
    }

    const candidatePath = join(toolDir, candidateFile);
    const cassette = await loadCassette(candidatePath);
    if (!cassette) {
      continue;
    }

    if (cacheKeysMatch(cassette.entry.key, normalizedKey)) {
      return {
        cassette,
        cassettePath: candidatePath,
      };
    }
  }

  return null;
}

export function getEvalWebSearchCacheModeFromEnv(): EvalWebSearchCacheMode {
  return EvalWebSearchCacheModeSchema.catch("replay_or_record").parse(
    process.env.BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_MODE,
  );
}

export function getEvalWebSearchCacheDirFromEnv(): string {
  return process.env.BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_DIR?.trim()
    ? normalizeConfiguredCacheDir(
        process.env.BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_DIR,
      )
    : process.env.BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_PATH?.trim()
      ? normalizeConfiguredCacheDir(
          process.env.BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_PATH,
        )
      : getDefaultCacheDir();
}

export async function clearEvalWebSearchCache({
  cacheDir = getEvalWebSearchCacheDirFromEnv(),
}: {
  cacheDir?: string;
} = {}) {
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
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }

    throw error;
  }
}

export function createEvalWebSearchCache({
  cacheDir = getEvalWebSearchCacheDirFromEnv(),
  mode = getEvalWebSearchCacheModeFromEnv(),
  debug = process.env.BOTTLE_CLASSIFIER_EVAL_WEB_SEARCH_CACHE_DEBUG === "1",
}: {
  cacheDir?: string;
  mode?: EvalWebSearchCacheMode;
  debug?: boolean;
} = {}): BottleWebSearchExecutionCache {
  const log = (message: string) => {
    if (debug) {
      console.log(`[bottle-classifier eval web cache] ${message}`);
    }
  };

  return {
    execute: async ({ key, schema, live }) => {
      const parsedMode = EvalWebSearchCacheModeSchema.parse(mode);
      const normalizedKey = normalizeCacheKey(key);
      if (parsedMode === "live") {
        log(
          `live ${normalizedKey.toolName ?? "web_search"} ${String(
            normalizedKey.query ?? "",
          )}`,
        );
        return schema.parse(await live());
      }

      if (parsedMode !== "refresh") {
        const match = await findMatchingCassette({
          cacheDir,
          key: normalizedKey,
        });
        if (match) {
          log(
            `replay ${normalizedKey.toolName ?? "web_search"} ${String(
              normalizedKey.query ?? "",
            )}`,
          );
          return schema.parse(match.cassette.entry.value);
        }
      }

      if (parsedMode === "replay_only") {
        throw new Error(
          `Missing eval web search cassette for ${String(
            normalizedKey.toolName ?? "web_search",
          )}: ${String(normalizedKey.query ?? "")}`,
        );
      }

      log(
        `record ${normalizedKey.toolName ?? "web_search"} ${String(
          normalizedKey.query ?? "",
        )}`,
      );
      const value = schema.parse(await live());
      if (isNonCacheableResult(value)) {
        return value;
      }

      const cassettePath = getCassettePath({
        cacheDir,
        key: normalizedKey,
      });
      await writeCassette(cassettePath, {
        version: EVAL_WEB_SEARCH_CACHE_VERSION,
        entry: {
          key: normalizedKey,
          recordedAt: new Date().toISOString(),
          value,
        },
      });
      return value;
    },
  };
}

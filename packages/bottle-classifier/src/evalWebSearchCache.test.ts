import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  clearEvalWebSearchCache,
  createEvalWebSearchCache,
} from "./evalWebSearchCache";

const SuccessSchema = z.object({
  provider: z.string(),
  query: z.string(),
});

const MixedResultSchema = z.union([
  SuccessSchema,
  z.object({
    error: z.string(),
  }),
]);

async function createTempCacheDir() {
  return mkdtemp(join(tmpdir(), "bottle-web-cache-"));
}

describe("evalWebSearchCache", () => {
  test("records successful live results and replays them on later runs", async () => {
    const cacheDir = await createTempCacheDir();
    let liveCalls = 0;
    const key = {
      toolName: "openai_web_search",
      model: "gpt-5.4",
      query: "wild turkey rare breed rye",
      braveFallbackEnabled: false,
    };

    const firstCache = createEvalWebSearchCache({
      cacheDir,
      mode: "replay_or_record",
    });
    const first = await firstCache.execute({
      key,
      schema: SuccessSchema,
      live: async () => {
        liveCalls += 1;
        return {
          provider: "openai",
          query: "wild turkey rare breed rye",
        };
      },
    });

    const secondCache = createEvalWebSearchCache({
      cacheDir,
      mode: "replay_only",
    });
    const second = await secondCache.execute({
      key,
      schema: SuccessSchema,
      live: async () => {
        liveCalls += 1;
        return {
          provider: "openai",
          query: "should-not-run",
        };
      },
    });

    expect(first).toEqual(second);
    expect(liveCalls).toBe(1);
  });

  test("writes readable per-query cassette files under tool directories", async () => {
    const cacheDir = await createTempCacheDir();
    const key = {
      toolName: "openai_web_search",
      model: "gpt-5.4",
      query: "wild turkey rare breed rye",
      braveFallbackEnabled: false,
    };

    const cache = createEvalWebSearchCache({
      cacheDir,
      mode: "replay_or_record",
    });

    await cache.execute({
      key,
      schema: SuccessSchema,
      live: async () => ({
        provider: "openai",
        query: "wild turkey rare breed rye",
      }),
    });

    const toolDirectories = (await readdir(cacheDir)).sort();
    expect(toolDirectories).toEqual(["openai-web-search"]);

    const cassetteFiles = (
      await readdir(join(cacheDir, "openai-web-search"))
    ).sort();
    expect(cassetteFiles).toHaveLength(1);
    expect(cassetteFiles[0]).toMatch(
      /^wild-turkey-rare-breed-rye--[a-f0-9]{40}\.json$/,
    );

    const cassette = JSON.parse(
      await readFile(
        join(cacheDir, "openai-web-search", cassetteFiles[0]),
        "utf8",
      ),
    );
    expect(cassette).toMatchObject({
      version: 1,
      entry: {
        key: {
          cacheKeyVersion: 1,
          toolName: "openai_web_search",
          model: "gpt-5.4",
          query: "wild turkey rare breed rye",
        },
        value: {
          provider: "openai",
          query: "wild turkey rare breed rye",
        },
      },
    });
  });

  test("refresh mode overwrites an existing cassette", async () => {
    const cacheDir = await createTempCacheDir();
    const key = {
      toolName: "openai_web_search",
      model: "gpt-5.4",
      query: "lagavulin distillers edition 2023",
      braveFallbackEnabled: true,
    };

    const recordCache = createEvalWebSearchCache({
      cacheDir,
      mode: "replay_or_record",
    });
    await recordCache.execute({
      key,
      schema: SuccessSchema,
      live: async () => ({
        provider: "openai",
        query: "first",
      }),
    });

    const refreshCache = createEvalWebSearchCache({
      cacheDir,
      mode: "refresh",
    });
    const refreshed = await refreshCache.execute({
      key,
      schema: SuccessSchema,
      live: async () => ({
        provider: "openai",
        query: "second",
      }),
    });

    const replayCache = createEvalWebSearchCache({
      cacheDir,
      mode: "replay_only",
    });
    const replayed = await replayCache.execute({
      key,
      schema: SuccessSchema,
      live: async () => ({
        provider: "openai",
        query: "should-not-run",
      }),
    });

    expect(refreshed).toEqual({
      provider: "openai",
      query: "second",
    });
    expect(replayed).toEqual(refreshed);
  });

  test("replays legacy cassettes whose stored keys include deprecated fields", async () => {
    const cacheDir = await createTempCacheDir();
    const legacyKey = {
      toolName: "openai_web_search",
      model: "gpt-5.4",
      query: "legacy openai query",
      braveFallbackEnabled: false,
    };
    const legacyCassettePath = join(
      cacheDir,
      "openai-web-search",
      "legacy-openai-query--5f4db27517b89ef4c6d0ae8aee96ee2307f7fe07.json",
    );

    await mkdir(dirname(legacyCassettePath), { recursive: true });
    await writeFile(
      legacyCassettePath,
      `${JSON.stringify(
        {
          version: 1,
          entry: {
            key: legacyKey,
            recordedAt: "2026-04-19T00:00:00.000Z",
            value: {
              provider: "openai",
              query: "legacy openai query",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    let liveCalls = 0;
    const cache = createEvalWebSearchCache({
      cacheDir,
      mode: "replay_only",
    });
    const replayed = await cache.execute({
      key: {
        toolName: "openai_web_search",
        model: "gpt-5.4",
        query: "legacy openai query",
      },
      schema: SuccessSchema,
      live: async () => {
        liveCalls += 1;
        return {
          provider: "openai",
          query: "should-not-run",
        };
      },
    });

    expect(replayed).toEqual({
      provider: "openai",
      query: "legacy openai query",
    });
    expect(liveCalls).toBe(0);
  });

  test("accepts newer cassette envelope versions when the entry shape is still compatible", async () => {
    const cacheDir = await createTempCacheDir();
    const cassettePath = join(
      cacheDir,
      "brave-web-search",
      "compatible-version--fixture.json",
    );

    await mkdir(dirname(cassettePath), { recursive: true });
    await writeFile(
      cassettePath,
      `${JSON.stringify(
        {
          version: 2,
          entry: {
            key: {
              cacheKeyVersion: 1,
              toolName: "brave_web_search",
              query: "compatible version",
            },
            recordedAt: "2026-04-19T00:00:00.000Z",
            value: {
              provider: "brave",
              query: "compatible version",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const cache = createEvalWebSearchCache({
      cacheDir,
      mode: "replay_only",
    });
    const replayed = await cache.execute({
      key: {
        toolName: "brave_web_search",
        query: "compatible version",
      },
      schema: SuccessSchema,
      live: async () => ({
        provider: "brave",
        query: "should-not-run",
      }),
    });

    expect(replayed).toEqual({
      provider: "brave",
      query: "compatible version",
    });
  });

  test("replay-only mode throws on a cache miss", async () => {
    const cacheDir = await createTempCacheDir();
    const cache = createEvalWebSearchCache({
      cacheDir,
      mode: "replay_only",
    });

    await expect(
      cache.execute({
        key: {
          toolName: "brave_web_search",
          query: "missing query",
        },
        schema: SuccessSchema,
        live: async () => ({
          provider: "brave",
          query: "missing query",
        }),
      }),
    ).rejects.toThrow("Missing eval web search cassette");
  });

  test("does not record transient top-level error results", async () => {
    const cacheDir = await createTempCacheDir();
    const key = {
      toolName: "openai_web_search",
      model: "gpt-5.4",
      query: "fragile query",
      braveFallbackEnabled: false,
    };
    let liveCalls = 0;
    const cache = createEvalWebSearchCache({
      cacheDir,
      mode: "replay_or_record",
    });

    const first = await cache.execute({
      key,
      schema: MixedResultSchema,
      live: async () => {
        liveCalls += 1;
        return {
          error: "temporary failure",
        };
      },
    });
    const second = await cache.execute({
      key,
      schema: MixedResultSchema,
      live: async () => {
        liveCalls += 1;
        return {
          provider: "openai",
          query: "fragile query",
        };
      },
    });

    expect(first).toEqual({
      error: "temporary failure",
    });
    expect(second).toEqual({
      provider: "openai",
      query: "fragile query",
    });
    expect(liveCalls).toBe(2);
  });

  test("clear removes recorded cassettes but keeps the cache root", async () => {
    const cacheDir = await createTempCacheDir();
    await mkdir(join(cacheDir, "openai-web-search"), { recursive: true });
    await writeFile(
      join(cacheDir, "openai-web-search", "fixture.json"),
      JSON.stringify({
        version: 1,
        entry: {},
      }),
    );
    await writeFile(join(cacheDir, ".gitkeep"), "");

    await clearEvalWebSearchCache({ cacheDir });

    await expect(
      readFile(join(cacheDir, "openai-web-search", "fixture.json"), "utf8"),
    ).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      readdir(cacheDir).then((entries) => entries.sort()),
    ).resolves.toEqual([".gitkeep"]);
  });
});

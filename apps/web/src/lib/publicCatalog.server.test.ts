import { IncrementalCache } from "next/dist/server/lib/incremental-cache";
import FileSystemCache from "next/dist/server/lib/incremental-cache/file-system-cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getStatsResponse } from "../app/api/stats/route";
import {
  getPageBottleList as loadBottleList,
  getPageEntityCatalog as loadEntityCatalog,
} from "./publicCatalog.server";
import { withNextRequest } from "./test/nextRequest";

await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  vi.stubGlobal("AsyncLocalStorage", AsyncLocalStorage);
  vi.stubEnv(
    "SESSION_SECRET",
    "peated-cache-tests-session-secret-for-local-tests",
  );
});

let accessToken: string | null = null;

function getPageBottleList(input: Parameters<typeof loadBottleList>[0]) {
  return withNextRequest(accessToken, () => loadBottleList(input));
}

function getPageEntityCatalog(entity: number) {
  return withNextRequest(accessToken, () => loadEntityCatalog(entity));
}

const fetchMock = vi.fn<typeof fetch>();
let cacheNumber = 0;

beforeEach(() => {
  accessToken = null;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // Exercise Next's real cache and oRPC transport, replacing only the upstream API.
  vi.stubGlobal(
    "__incrementalCache",
    new IncrementalCache({
      dev: false,
      requestHeaders: {},
      flushToDisk: false,
      maxMemoryCacheSize: 1024 * 1024,
      CurCacheHandler: FileSystemCache,
      fetchCacheKeyPrefix: `public-catalog-test-${++cacheNumber}`,
      getPrerenderManifest: () => ({
        version: 4,
        routes: {},
        dynamicRoutes: {},
        notFoundRoutes: [],
        preview: {
          previewModeId: "test",
          previewModeEncryptionKey: "test",
          previewModeSigningKey: "test",
        },
      }),
    }),
  );
  fetchMock.mockImplementation(async (input, init) => {
    const request = new Request(input, init);
    return Response.json({
      json: {
        results: [{ id: 1, isFavorite: request.headers.has("authorization") }],
        total: fetchMock.mock.calls.length,
      },
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("public catalog page reads", () => {
  it("reuses anonymous lists without sharing member state in either direction", async () => {
    const input = { entity: 1, limit: 4, sort: "-release" } as const;
    const publicList = await getPageBottleList(input);
    expect(
      await getPageBottleList({ ...input, cursor: 1, filter: "all" }),
    ).toEqual(publicList);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      await getPageBottleList({ entity: "1", limit: "4", sort: "-release" }),
    ).toEqual(publicList);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    accessToken = "test-member";
    expect((await getPageBottleList(input)).results[0].isFavorite).toBe(true);
    await getPageBottleList(input);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    accessToken = null;
    expect(await getPageBottleList(input)).toEqual(publicList);
    expect(publicList.results[0].isFavorite).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("separates entity, series, view, sort, and limit cache keys", async () => {
    const inputs = [
      { entity: 1 },
      { entity: 2 },
      { series: 1 },
      { entity: 1, distilleryView: "releases" },
      { entity: 1, distilleryView: "other" },
      { entity: 1, sort: "-release" },
      { entity: 1, limit: 4 },
    ] as const;
    for (const input of inputs) {
      const result = await getPageBottleList(input);
      expect(await getPageBottleList(input)).toEqual(result);
    }
    expect(fetchMock).toHaveBeenCalledTimes(inputs.length);
  });

  it.each([
    { entity: 1, cursor: 2 },
    { entity: 1, query: "peat" },
    { entity: 1, query: 0 },
    { entity: 1, library: "in" },
    { entity: 1, filter: "following" },
    { entity: 1, category: "single_malt" },
    { entity: 1, flight: "private-flight" },
    {},
  ] as const)("does not cache filtered or unscoped input %j", async (input) => {
    await getPageBottleList(input);
    await getPageBottleList(input);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes catalog snapshots after five minutes and bypasses them for members", async () => {
    vi.useFakeTimers({ toFake: ["Date", "performance"] });
    const catalog = await getPageEntityCatalog(1);
    expect(await getPageEntityCatalog(1)).toEqual(catalog);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(301_000);
    expect(await getPageEntityCatalog(1)).toEqual(catalog);
    expect(await getPageEntityCatalog(1)).not.toEqual(catalog);
    accessToken = "test-member";
    await getPageEntityCatalog(1);
    await getPageEntityCatalog(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("propagates failures without caching an empty catalog", async () => {
    fetchMock.mockRejectedValueOnce(new Error("API unavailable"));
    await expect(getPageEntityCatalog(1)).rejects.toThrow("API unavailable");
    await getPageEntityCatalog(1);
    await getPageEntityCatalog(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

it("serves the same anonymous stats snapshot to visitors and members", async () => {
  const first = await (
    await withNextRequest(accessToken, getStatsResponse)
  ).json();
  accessToken = "test-member";
  const second = await withNextRequest(accessToken, getStatsResponse);
  expect(await second.json()).toEqual(first);
  expect(second.headers.get("cache-control")).toBe("no-store");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [input, init] = fetchMock.mock.calls[0];
  const headers =
    input instanceof Request ? input.headers : new Headers(init?.headers);
  expect(headers.has("authorization")).toBe(false);
});

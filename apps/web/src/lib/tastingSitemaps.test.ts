import { describe, expect, it, vi } from "vitest";

import {
  getTastingSitemapPagePaths,
  loadTastingSitemapPage,
} from "./tastingSitemaps";

const bottle = { name: "16-year-old", brand: { name: "Lagavulin" } };

describe("tasting sitemaps", () => {
  it("splits the index into pages of at most 1,000 tastings", () => {
    expect(getTastingSitemapPagePaths(0)).toEqual([]);
    expect(getTastingSitemapPagePaths(1001)).toEqual([
      "/sitemaps/tastings/1/sitemap.xml",
      "/sitemaps/tastings/2/sitemap.xml",
    ]);
  });

  it("loads the requested page, excludes private tastings, and stops at the end", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        results: [
          { id: 101, bottle, createdBy: { private: false } },
          { id: 102, bottle, createdBy: { private: true } },
        ],
        rel: { nextCursor: 12 },
      })
      .mockResolvedValueOnce({
        results: [{ id: 103, bottle, createdBy: { private: false } }],
        rel: { nextCursor: null },
      });
    await expect(loadTastingSitemapPage(2, list)).resolves.toEqual([
      { url: "/tastings/101-lagavulin-16-year-old" },
      { url: "/tastings/103-lagavulin-16-year-old" },
    ]);
    expect(list).toHaveBeenNthCalledWith(1, { cursor: 11, limit: 100 });
    expect(list).toHaveBeenNthCalledWith(2, { cursor: 12, limit: 100 });
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("bounds API reads even when a page has private records", async () => {
    const list = vi.fn(
      async ({ cursor }: { cursor: number; limit: number }) => ({
        results: [{ id: cursor, bottle, createdBy: { private: true } }],
        rel: { nextCursor: cursor + 1 },
      }),
    );
    await expect(loadTastingSitemapPage(1, list)).resolves.toEqual([]);
    expect(list).toHaveBeenCalledTimes(10);
  });
});

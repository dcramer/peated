import { describe, expect, it, vi } from "vitest";
import {
  ENTITY_SITEMAP_COLLECTIONS,
  getEntitySitemapCollection,
  getEntitySitemapPagePaths,
  loadEntitySitemapPage,
} from "./entitySitemaps";

describe("Entity sitemaps", () => {
  it("defines one sitemap collection for each Entity kind", () => {
    expect(ENTITY_SITEMAP_COLLECTIONS).toEqual([
      {
        clientKey: "brands",
        collection: "brands",
        kind: "brand",
        statsKey: "totalBrands",
      },
      {
        clientKey: "distilleries",
        collection: "distillers",
        kind: "distillery",
        statsKey: "totalDistilleries",
      },
      {
        clientKey: "bottlers",
        collection: "bottlers",
        kind: "bottler",
        statsKey: "totalBottlers",
      },
      {
        clientKey: "blenders",
        collection: "blenders",
        kind: "blender",
        statsKey: "totalBlenders",
      },
      {
        clientKey: "companies",
        collection: "companies",
        kind: "company",
        statsKey: "totalCompanies",
      },
    ]);
    expect(getEntitySitemapCollection("entities")).toBeUndefined();
  });

  it("creates one sitemap page path per 1,000 entities", () => {
    expect(getEntitySitemapPagePaths("brands", 2_001)).toEqual([
      "/sitemaps/brands/1/sitemap.xml",
      "/sitemaps/brands/2/sitemap.xml",
      "/sitemaps/brands/3/sitemap.xml",
    ]);
  });

  it("loads only the API pages for the requested sitemap page", async () => {
    const listEntities = vi
      .fn()
      .mockResolvedValueOnce({
        results: [
          {
            id: 1001,
            kind: "brand",
            updatedAt: "2026-08-27T12:00:00.000Z",
          },
        ],
        rel: { nextCursor: 4 },
      })
      .mockResolvedValueOnce({
        results: [
          {
            id: 1002,
            kind: "brand",
            updatedAt: "2026-08-28T12:00:00.000Z",
          },
        ],
        rel: { nextCursor: null },
      });

    await expect(loadEntitySitemapPage(2, listEntities)).resolves.toEqual({
      pages: [
        {
          url: "/brands/1001",
          lastModified: "2026-08-27T12:00:00.000Z",
        },
        {
          url: "/brands/1002",
          lastModified: "2026-08-28T12:00:00.000Z",
        },
      ],
      startCursor: 3,
    });
    expect(listEntities).toHaveBeenNthCalledWith(1, {
      cursor: 3,
      limit: 500,
      sort: "created",
    });
    expect(listEntities).toHaveBeenNthCalledWith(2, {
      cursor: 4,
      limit: 500,
      sort: "created",
    });
  });
});

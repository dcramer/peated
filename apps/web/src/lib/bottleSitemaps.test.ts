import { describe, expect, it, vi } from "vitest";

import {
  loadBottleSitemapPage,
  type ListSitemapBottles,
} from "./bottleSitemaps";

type ListResult = Awaited<ReturnType<ListSitemapBottles>>;

describe("Bottle sitemaps", () => {
  it("loads all API pages for a sitemap together", async () => {
    const requests: {
      cursor: number;
      resolve: (result: ListResult) => void;
    }[] = [];
    const listBottles = vi.fn(
      ({ cursor }: Parameters<ListSitemapBottles>[0]) =>
        new Promise<ListResult>((resolve) => {
          requests.push({ cursor, resolve });
        }),
    );

    const loading = loadBottleSitemapPage(2, listBottles);

    expect(listBottles).toHaveBeenCalledTimes(10);
    expect(requests.map(({ cursor }) => cursor)).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);

    for (const request of requests) {
      request.resolve({
        results:
          request.cursor === 11
            ? [
                {
                  id: 11,
                  name: "Release 11",
                  brand: { name: "Example Distillery" },
                  updatedAt: "2026-09-01T12:00:00.000Z",
                },
              ]
            : [],
      });
    }

    await expect(loading).resolves.toEqual({
      pages: [
        {
          url: "/bottles/11-example-distillery-release-11",
          lastModified: "2026-09-01T12:00:00.000Z",
        },
      ],
      startCursor: 11,
    });
  });
});

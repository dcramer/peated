import { describe, expect, it, vi } from "vitest";

import {
  loadBottleSitemapPage,
  type ListSitemapBottles,
} from "./bottleSitemaps";

type ListResult = Awaited<ReturnType<ListSitemapBottles>>;

describe("Bottle sitemaps", () => {
  it("loads one dedicated API page for a sitemap", async () => {
    const listBottles = vi.fn(
      async (): Promise<ListResult> => ({
        results: [
          {
            id: 11,
            fullName: "Example Distillery Release 11",
            updatedAt: "2026-09-01T12:00:00.000Z",
          },
        ],
      }),
    );

    await expect(loadBottleSitemapPage(2, listBottles)).resolves.toEqual([
      {
        url: "/bottles/11-example-distillery-release-11",
        lastModified: "2026-09-01T12:00:00.000Z",
      },
    ]);
    expect(listBottles).toHaveBeenCalledOnce();
    expect(listBottles).toHaveBeenCalledWith({ page: 2 });
  });
});

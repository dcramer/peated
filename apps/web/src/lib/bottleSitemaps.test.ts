import { describe, expect, it, vi } from "vitest";

import {
  loadBottleSitemapPage,
  type ListSitemapBottles,
} from "./bottleSitemaps";

type ListResult = Awaited<ReturnType<ListSitemapBottles>>;

describe("Bottle sitemaps", () => {
  it("lists each Bottle at its canonical page URL", async () => {
    const listBottles = vi.fn(
      async (): Promise<ListResult> => ({
        results: [
          {
            id: 11,
            name: "Supernova",
            edition: null,
            statedAge: null,
            vintageYear: null,
            releaseYear: null,
            abv: null,
            singleCask: null,
            caskStrength: null,
            brand: { name: "Example Distillery", shortName: "Example" },
            series: { name: "Committee Release" },
            group: { name: "Supernova" },
            updatedAt: "2026-09-01T12:00:00.000Z",
          },
        ],
      }),
    );

    await expect(loadBottleSitemapPage(2, listBottles)).resolves.toEqual([
      {
        url: "/bottles/11-example-committee-release-supernova",
        lastModified: "2026-09-01T12:00:00.000Z",
      },
    ]);
    expect(listBottles).toHaveBeenCalledOnce();
    expect(listBottles).toHaveBeenCalledWith({ page: 2 });
  });
});

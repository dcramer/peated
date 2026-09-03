import { describe, expect, it, vi } from "vitest";
import {
  getCountrySitemapPages,
  loadRegionSitemap,
  loadSitemapCountries,
} from "./locationSitemaps";

describe("location sitemaps", () => {
  it("reads every country page and includes their public tabs", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        results: [{ slug: "scotland" }],
        rel: { nextCursor: 2 },
      })
      .mockResolvedValueOnce({
        results: [{ slug: "japan" }],
        rel: { nextCursor: null },
      });
    const countries = await loadSitemapCountries(list);
    expect(list.mock.calls.map(([input]) => input)).toEqual([
      { cursor: 1, limit: 100, sort: "name" },
      { cursor: 2, limit: 100, sort: "name" },
    ]);
    expect(getCountrySitemapPages(countries).map(({ url }) => url)).toEqual([
      "/locations",
      "/locations/all-regions",
      "/locations/scotland",
      "/locations/scotland/bottles",
      "/locations/scotland/distillers",
      "/locations/scotland/regions",
      "/locations/japan",
      "/locations/japan/bottles",
      "/locations/japan/distillers",
      "/locations/japan/regions",
    ]);
  });
  it("paginates regions within one country and uses returned canonical slugs", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        results: [{ slug: "islay", country: { slug: "scotland" } }],
        rel: { nextCursor: 2 },
      })
      .mockResolvedValueOnce({
        results: [{ slug: "speyside", country: { slug: "scotland" } }],
        rel: { nextCursor: null },
      });
    const pages = await loadRegionSitemap("scotland", list);
    expect(pages).toEqual(
      ["islay", "speyside"].flatMap((region) =>
        ["", "/bottles", "/distillers"].map((suffix) => ({
          url: `/locations/scotland/regions/${region}${suffix}`,
        })),
      ),
    );
    expect(list).toHaveBeenLastCalledWith({
      country: "scotland",
      cursor: 2,
      limit: 100,
      sort: "name",
    });
  });
  it("leaves an empty region map empty and propagates API failures", async () => {
    await expect(
      loadRegionSitemap("japan", async () => ({
        results: [],
        rel: { nextCursor: null },
      })),
    ).resolves.toEqual([]);
    await expect(
      loadSitemapCountries(async () => {
        throw new Error("API unavailable");
      }),
    ).rejects.toThrow("API unavailable");
  });
});

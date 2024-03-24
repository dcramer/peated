import { loadFixture } from "@peated/server/lib/test/fixtures";
import mockAxios from "vitest-mock-axios";
import { scrapeProducts } from "./scrapeTotalWine";

test("simple", async () => {
  const url =
    "https://www.totalwine.com/spirits/scotch/single-malt/c/000887?viewall=true&pageSize=120&aty=0,0,0,0";
  const result = await loadFixture("totalwine", "bottle-list.html");

  const items: any[] = [];

  const fn = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  expect(mockAxios.get).toHaveBeenCalledOnce();

  mockAxios.mockResponseFor({ url }, { data: result });

  await fn;

  expect(items.length).toBe(119);
  expect(items[0]).toEqual({
    name: "Grangestone Bourbon Cask Finish Single Malt Scotch Whisky",
    price: 6499,
    priceUnit: "USD",
    volume: 1750,
    url: "https://www.totalwine.com/spirits/scotch/single-malt/grangestone-bourbon-cask-finish-single-malt-scotch-whisky/p/135113175?s=1203&igrules=true",
  });
});

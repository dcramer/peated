import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeProducts } from "./scrapeTotalWine";

test("simple", async ({ axiosMock }) => {
  const url =
    "https://www.totalwine.com/spirits/scotch/single-malt/c/000887?viewall=true&pageSize=120&aty=0,0,0,0";
  const result = await loadFixture("totalwine", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toMatchInlineSnapshot(`109`);
  expect(items[0]).toMatchInlineSnapshot(`
    {
      "currency": "usd",
      "name": "Grangestone Bourbon Cask Finish Single Malt Scotch Whisky",
      "price": 6499,
      "url": "https://www.totalwine.com/spirits/scotch/single-malt/grangestone-bourbon-cask-finish-single-malt-scotch-whisky/p/135113175?s=1203&igrules=true",
      "volume": 1750,
    }
  `);
});

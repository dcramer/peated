import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeProducts } from "./scrapeAstorWines";

test("simple", async ({ axiosMock }) => {
  const url =
    "https://www.astorwines.com/SpiritsSearchResult.aspx?search=Advanced&searchtype=Contains&term=&cat=2&style=3_41&srt=1&instockonly=True";
  const result = await loadFixture("astorwines", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toBe(12);
  expect(items[0]).toEqual({
    name: "Aberfeldy 12-year-old Single Malt Scotch Whisky",
    price: 4496,
    currency: "usd",
    volume: 750,
    url: "https://www.astorwines.com/item/16747",
  });
});

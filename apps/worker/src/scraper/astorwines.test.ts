import mockAxios from "vitest-mock-axios";
import { loadFixture } from "~/lib/test";
import { scrapeProducts } from "./astorwines";

process.env.DISABLE_HTTP_CACHE = "1";

test("simple", async () => {
  const url =
    "https://www.astorwines.com/SpiritsSearchResult.aspx?search=Advanced&searchtype=Contains&term=&cat=2&style=3_41&srt=1&instockonly=True";
  const result = await loadFixture("astorwines", "bottle-list.html");

  const items: any[] = [];

  const fn = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  expect(mockAxios.get).toHaveBeenCalledOnce();

  mockAxios.mockResponseFor({ url }, { data: result });

  await fn;

  expect(items.length).toBe(12);
  expect(items[0]).toEqual({
    name: "Aberfeldy 12-year-old Single Malt Scotch Whisky",
    price: 4496,
    priceUnit: "USD",
    volume: 750,
    url: "https://www.astorwines.com/item/16747",
  });
});

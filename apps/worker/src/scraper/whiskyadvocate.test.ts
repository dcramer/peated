import mockAxios from "vitest-mock-axios";
import { loadFixture } from "~/lib/test";
import scrapeWhiskyAdvocate from "./scrapeWhiskyAdvocate";

process.env.DISABLE_HTTP_CACHE = "1";

test("simple", async () => {
  const url =
    "https://whiskyadvocate.com/ratings-reviews?custom_rating_issue%5B0%5D=Winter+2023&order_by=published_desc";
  const result = await loadFixture("whiskyadvocate", "bottle-list.html");

  const items: any[] = [];

  const fn = scrapeWhiskyAdvocate(url, async (item) => {
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

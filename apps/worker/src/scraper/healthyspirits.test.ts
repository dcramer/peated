import { loadFixture } from "@peated/worker/lib/test";
import mockAxios from "vitest-mock-axios";
import { scrapeProducts } from "./healthyspirits";

process.env.DISABLE_HTTP_CACHE = "1";

test("simple", async () => {
  const url =
    "https://www.healthyspirits.com/spirits/whiskey/page1.html?limit=72";
  const result = await loadFixture("healthyspirits", "bottle-list.html");

  const items: any[] = [];

  const fn = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  expect(mockAxios.get).toHaveBeenCalledOnce();

  mockAxios.mockResponseFor({ url }, { data: result });

  await fn;

  expect(items.length).toBe(5);
  expect(items[0]).toEqual({
    name: "Bruichladdich Black Art 1992 Edition 9.1 29-year-old Single Malt",
    price: 69999,
    priceUnit: "USD",
    volume: 750,
    url: "https://www.healthyspirits.com/copy-of-bruichladdich-black-art-1990-edition-61-si.html",
  });
});

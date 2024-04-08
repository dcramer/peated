import { loadFixture } from "@peated/server/lib/test/fixtures";
import mockAxios from "vitest-mock-axios";
import { scrapeProducts } from "./scrapeWoodenCork";

test("simple", async () => {
  const url = "https://woodencork.com/collections/whiskey?cursor=2";
  const result = await loadFixture("woodencork", "bottle-list.html");

  const items: any[] = [];

  const fn = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  expect(mockAxios.get).toHaveBeenCalledOnce();

  mockAxios.mockResponseFor({ url }, { data: result });

  await fn;

  expect(items.length).toBe(39);
  expect(items[0]).toEqual({
    name: "Elmer T. Lee Single Barrel Bourbon",
    price: 33899,
    priceUnit: "USD",
    volume: 750,
    url: "https://woodencork.com/collections/whiskey/products/elmer-t-lee-bourbon",
  });
});

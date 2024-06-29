import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeProducts } from "./scrapeWoodenCork";

test("simple", async ({ axiosMock }) => {
  const url = "https://woodencork.com/collections/whiskey?cursor=2";
  const result = await loadFixture("woodencork", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toBe(39);
  expect(items[0]).toEqual({
    name: "Elmer T. Lee Single Barrel Bourbon",
    price: 33899,
    currency: "usd",
    volume: 750,
    url: "https://woodencork.com/collections/whiskey/products/elmer-t-lee-bourbon",
  });
});

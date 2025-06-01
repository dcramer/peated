import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeProducts } from "./scrapeReserveBar";

test("simple", async ({ axiosMock }) => {
  const url = "https://www.reservebar.com/collections/whiskey?start=0&sz=36";
  const result = await loadFixture("reservebar", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toMatchInlineSnapshot("23");
  expect(items[0]).toMatchInlineSnapshot(`
    {
      "currency": "usd",
      "name": "Jack Daniel's Gentleman Jack Tennessee Whiskey",
      "price": 3999,
      "url": "https://www.reservebar.com/products/jack-daniels-gentleman-jack/GROUPING-38632.html",
      "volume": 750,
    }
  `);
  expect(items[1]).toMatchInlineSnapshot(`
    {
      "currency": "usd",
      "name": "Wyoming Whiskey Small Batch Bourbon Whiskey",
      "price": 3899,
      "url": "https://www.reservebar.com/products/wyoming-whiskey-small-batch-bourbon-whiskey/GROUPING-128453.html",
      "volume": 750,
    }
  `);
});

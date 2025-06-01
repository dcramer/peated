import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeProducts } from "./scrapeHealthySpirits";

test("simple", async ({ axiosMock }) => {
  const url =
    "https://www.healthyspirits.com/spirits/whiskey/page1.html?limit=72";
  const result = await loadFixture("healthyspirits", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeProducts(url, async (item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toMatchInlineSnapshot("4");
  expect(items[0]).toMatchInlineSnapshot(`
    {
      "currency": "usd",
      "name": "Bruichladdich Black Art 1992 Edition 9.1 29-year-old Single Malt",
      "price": 69999,
      "url": "https://www.healthyspirits.com/copy-of-bruichladdich-black-art-1990-edition-61-si.html",
      "volume": 750,
    }
  `);
});

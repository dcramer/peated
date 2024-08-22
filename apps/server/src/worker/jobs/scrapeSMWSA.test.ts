import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeBottles } from "./scrapeSMWSA";

test("bottle list", async ({ axiosMock }) => {
  const url = "https://newmake.smwsa.com/collections/all-products";
  const result = await loadFixture("smwsa", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeBottles(url, async (...item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toBe(35);
  expect(items[0]).toMatchInlineSnapshot(`
    [
      {
        "bottler": {
          "name": "The Scotch Malt Whisky Society",
        },
        "brand": {
          "name": "The Scotch Malt Whisky Society",
        },
        "caskFill": null,
        "caskSize": "barrel",
        "caskType": "oak",
        "category": "single_malt",
        "distillers": [
          {
            "name": "Dailuaine",
          },
        ],
        "flavorProfile": "juicy_oak_vanilla",
        "name": "41.176 Baristaliscious",
        "releaseYear": null,
        "singleCask": true,
        "statedAge": 17,
        "vintageYear": null,
      },
      {
        "currency": "usd",
        "name": "SMWS 41.176 Baristaliscious",
        "price": 18500,
        "url": "https://newmake.smwsa.com/products/cask-no-41-176",
        "volume": 750,
      },
      "https://optimise2.assets-servd.host/smw-casper/production/product-assets/Bottle%20Images/41.176-US-web.png?w=391&h=1560&auto=compress%2Cformat&fit=crop&dm=1701177310&s=6befd8c2d4b968942ed306a443c5fe2d",
    ]
  `);
  expect(items[1]).toMatchInlineSnapshot(`
    [
      {
        "bottler": {
          "name": "The Scotch Malt Whisky Society",
        },
        "brand": {
          "name": "The Scotch Malt Whisky Society",
        },
        "caskFill": null,
        "caskSize": "barrique",
        "caskType": null,
        "category": "single_malt",
        "distillers": [
          {
            "name": "Fettercairn",
          },
        ],
        "flavorProfile": "deep_rich_dried_fruit",
        "name": "94.45 Sultans of Swig",
        "releaseYear": null,
        "singleCask": true,
        "statedAge": 14,
        "vintageYear": null,
      },
      {
        "currency": "usd",
        "name": "SMWS 94.45 Sultans of Swig",
        "price": 16500,
        "url": "https://newmake.smwsa.com/products/cask-no-94-45",
        "volume": 750,
      },
      "https://optimise2.assets-servd.host/smw-casper/production/product-assets/Bottle%20Images/94.45-US-web.png?w=391&h=1560&auto=compress%2Cformat&fit=crop&dm=1695934352&s=2f758c64036b49f67acfb0a266a68514",
    ]
  `);
});

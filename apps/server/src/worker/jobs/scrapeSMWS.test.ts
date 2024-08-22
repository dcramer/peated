import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeBottles } from "./scrapeSMWS";

process.env.DISABLE_HTTP_CACHE = "1";

test("bottle list", async ({ axiosMock }) => {
  const url = "https://smws.com/all-whisky?filter-page=1&per-page=128";
  const result = await loadFixture("smws", "bottle-list.json");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeBottles(url, async (...item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toBe(128);
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
        "caskSize": null,
        "caskType": null,
        "category": "rye",
        "distillers": [
          {
            "name": "New York Distilling Co.",
          },
        ],
        "flavorProfile": null,
        "name": "RW3.6 Truly a flavour bomb",
        "releaseYear": 2023,
        "singleCask": true,
        "statedAge": 5,
        "vintageYear": null,
      },
      {
        "currency": "gbp",
        "name": "SMWS RW3.6 Truly a flavour bomb",
        "price": 6500,
        "url": "https://smws.com/truly-a-flavour-bomb/",
        "volume": 750,
      },
      "https://cdn11.bigcommerce.com/s-vagfena5nz/products/4399/images/6955/RW3.6-web__05977.1696343897.386.513.png?c=1",
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
        "caskFill": "2nd_fill",
        "caskSize": "hogshead",
        "caskType": "bourbon",
        "category": "single_malt",
        "distillers": [
          {
            "name": "Bowmore",
          },
        ],
        "flavorProfile": "lightly_peated",
        "name": "3.350 Gladrags of yesteryear",
        "releaseYear": 2023,
        "singleCask": true,
        "statedAge": 19,
        "vintageYear": null,
      },
      {
        "currency": "gbp",
        "name": "SMWS 3.350 Gladrags of yesteryear",
        "price": 17950,
        "url": "https://smws.com/gladrags-of-yesteryear/",
        "volume": 750,
      },
      "https://cdn11.bigcommerce.com/s-vagfena5nz/products/4702/images/7487/3.350-GX-web__19122.1704362139.386.513.png?c=1",
    ]
  `);
});

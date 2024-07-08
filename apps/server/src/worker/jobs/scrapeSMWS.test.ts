import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeBottles } from "./scrapeSMWS";

process.env.DISABLE_HTTP_CACHE = "1";

test("bottle list", async ({ axiosMock }) => {
  const url = "https://smws.com/all-whisky?filter-page=1&per-page=128";
  const result = await loadFixture("smws", "bottle-list.json");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeBottles(url, async (item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toBe(128);
  expect(items[0]).toMatchInlineSnapshot(`
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
      "statedAge": 5,
    }
  `);
  expect(items[1]).toMatchInlineSnapshot(`
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
      "statedAge": 19,
    }
  `);
});

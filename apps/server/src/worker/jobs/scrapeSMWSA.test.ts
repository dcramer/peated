import { loadFixture } from "@peated/server/lib/test/fixtures";
import { scrapeBottles } from "./scrapeSMWSA";

test("bottle list", async ({ axiosMock }) => {
  const url = "https://newmake.smwsa.com/collections/all-products";
  const result = await loadFixture("smwsa", "bottle-list.html");

  axiosMock.onGet(url).reply(200, result);

  const items: any[] = [];

  const fn = scrapeBottles(url, async (item) => {
    items.push(item);
  });

  await fn;

  expect(items.length).toBe(35);
  expect(items[0]).toMatchInlineSnapshot(`
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
      "statedAge": 17,
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
      "statedAge": 14,
    }
  `);
});

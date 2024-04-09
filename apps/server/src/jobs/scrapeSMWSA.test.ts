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
  expect(items[0]).toEqual({
    name: "41.176 Baristaliscious",
    brand: {
      name: "The Scotch Malt Whisky Society",
    },
    bottler: {
      name: "The Scotch Malt Whisky Society",
    },
    category: "single_malt",
    distillers: [
      {
        name: "Dailuaine",
      },
    ],
    statedAge: 17,
  });
});

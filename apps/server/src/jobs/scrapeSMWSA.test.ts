import { loadFixture } from "@peated/server/lib/test/fixtures";
import mockAxios from "vitest-mock-axios";
import { scrapeBottles } from "./scrapeSMWSA";

test("bottle list", async () => {
  const url = "https://newmake.smwsa.com/collections/all-products";
  const result = await loadFixture("smwsa", "bottle-list.html");

  const items: any[] = [];

  const fn = scrapeBottles(url, async (item) => {
    items.push(item);
  });

  mockAxios.mockResponseFor({ url }, { data: result });

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

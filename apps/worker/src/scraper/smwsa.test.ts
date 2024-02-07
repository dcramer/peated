import { loadFixture } from "@peated/worker/lib/test";
import mockAxios from "vitest-mock-axios";
import { scrapeBottles } from "./smwsa";

process.env.DISABLE_HTTP_CACHE = "1";

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
    category: "single_malt",
    distillers: [
      {
        name: "Dailuaine",
      },
    ],
    statedAge: 17,
  });
});

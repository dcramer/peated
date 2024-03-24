import { loadFixture } from "@peated/server/lib/test/fixtures";
import mockAxios from "vitest-mock-axios";
import { scrapeBottles } from "./scrapeSMWS";

process.env.DISABLE_HTTP_CACHE = "1";

test("bottle list", async () => {
  const url = "https://smws.com/all-whisky?filter-page=1&per-page=128";
  const result = await loadFixture("smws", "bottle-list.json");

  const items: any[] = [];

  const fn = scrapeBottles(url, async (item) => {
    items.push(item);
  });

  mockAxios.mockResponseFor({ url }, { data: result });

  await fn;

  expect(items.length).toBe(128);
  expect(items[0]).toEqual({
    name: "RW3.6 Truly a flavour bomb",
    brand: {
      name: "The Scotch Malt Whisky Society",
    },
    bottler: {
      name: "The Scotch Malt Whisky Society",
    },
    category: "rye",
    distillers: [
      {
        name: "New York Distilling Co.",
      },
    ],
    statedAge: 5,
  });
});

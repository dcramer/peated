import { loadFixture } from "@peated/server/lib/test/fixtures";
import mockAxios from "vitest-mock-axios";
import { scrapeIssueList, scrapeReviews } from "./scrapeWhiskyAdvocate";

test("review list", async () => {
  const url =
    "https://whiskyadvocate.com/ratings-reviews?custom_rating_issue%5B0%5D=Winter+2023&order_by=published_desc";
  const result = await loadFixture("whiskyadvocate", "bottle-list.html");

  const items: any[] = [];

  const fn = scrapeReviews(url, async (item) => {
    items.push(item);
  });

  mockAxios.mockResponseFor({ url }, { data: result });

  await fn;

  expect(items.length).toBe(166);
  expect(items[0]).toEqual({
    name: "Angel's Envy Cask Strength Sauternes and Toasted Oak Barrel Finished (Batch RC1)",
    category: "rye",
    rating: 94,
    issue: "Winter 2023",
    url: "https://whiskyadvocate.com/Angel-s-Envy-Cask-Strength-Sauternes-and-Toasted-Oak-Barrel-Finished-Batch-RC1-57-2",
  });
});

test("issue list", async () => {
  const url = "https://whiskyadvocate.com/ratings-reviews";
  const result = await loadFixture("whiskyadvocate", "empty-search.html");

  const fn = scrapeIssueList(url);

  mockAxios.mockResponseFor({ url }, { data: result });

  const items = await fn;

  expect(items.length).toBe(106);
  expect(items[0]).toEqual("Winter 2023");
});
